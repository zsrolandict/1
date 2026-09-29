import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_ANALYSIS_RAW, SAMPLE_FACTS, SAMPLE_NOTES } from './sample';
import { notesToTranscript } from './transcript';

// Élő API nélkül ellenőrizzük a kérés formáját és a válasz feldolgozását:
// helyi mock szerver fogadja az SDK kérését és ad vissza egy Messages API választ.

let server: Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a mock szerver tetszőleges JSON-t fogad; a tesztek mélyen belenéznek
let lastRequest: { headers: Record<string, unknown>; body: Record<string, any> } | null = null;
let nextResponse: Record<string, unknown> = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      lastRequest = { headers: req.headers, body: JSON.parse(data) };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(nextResponse));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const message = (text: string, stop_reason = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5',
  content: [{ type: 'text', text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

describe('analyzeInterview (mock API)', () => {
  it('helyes kérést küld és ellenőrzi a választ', async () => {
    const { analyzeInterview } = await import('./ai.server');
    const modelOutput = {
      ...SAMPLE_ANALYSIS_RAW,
      statements: SAMPLE_ANALYSIS_RAW.statements.map(({ startMs, ...s }) => s),
      suggestedRedFlags: SAMPLE_ANALYSIS_RAW.suggestedRedFlags.map(({ startMs, ...f }) => ({ ...f, likelihood: 9 })),
      contradictions: SAMPLE_ANALYSIS_RAW.contradictions.map(({ startMs, conflictingSource, ...c }) => c),
    };
    nextResponse = message(JSON.stringify(modelOutput));

    const res = await analyzeInterview({
      transcript: notesToTranscript(SAMPLE_NOTES),
      role: 'OWNER_CEO',
      kind: 'VENDOR_DD',
      facts: SAMPLE_FACTS,
    });

    const body = lastRequest!.body;
    expect(body.model).toBe('claude-opus-5');
    expect(body.fallbacks).toBe('default');
    expect(String(lastRequest!.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.messages[0].content).toContain('id=F1');
    expect(body.messages[0].content).toContain('[00:32] Ügyvezető:');

    expect(res.suggestedRedFlags).toHaveLength(3);           // a kitalált idézetű kiesett
    expect(res.suggestedRedFlags.every((f) => f.likelihood === 5)).toBe(true); // 9 → 5
    expect(res.contradictions[0].startMs).toBe(32_000);      // időbélyeg a leiratból
    expect(res.discardedUnverified).toBe(1);
  });

  it('elutasítást (refusal) külön hibaként jelez', async () => {
    const { analyzeInterview, AiRefusalError } = await import('./ai.server');
    nextResponse = message('', 'refusal');
    await expect(
      analyzeInterview({ transcript: notesToTranscript(SAMPLE_NOTES), role: 'CFO', kind: 'HEALTH_CHECK', facts: [] }),
    ).rejects.toBeInstanceOf(AiRefusalError);
  });
});
