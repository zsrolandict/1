import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_DOCUMENTS } from '../samples/documents';
import { redactPages } from './redact';

// Élő API nélkül: helyi mock szerver fogadja az SDK kérését.
let server: Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a mock szerver tetszőleges JSON-t fogad; a tesztek mélyen belenéznek
let lastBody: Record<string, any> = {};
let nextText = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      lastBody = JSON.parse(data);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          content: [{ type: 'text', text: nextText }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe('analyzeDocument (mock API)', () => {
  it('maszkolt szöveget küld, ellenőrzi az idézeteket, ismeretlen kódot elvet', async () => {
    const { analyzeDocument } = await import('./ai.server');
    const doc = SAMPLE_DOCUMENTS.gyarto[0];
    const { pages } = redactPages(doc.pages);
    const raw = doc.analysis;
    nextText = JSON.stringify({
      ...raw,
      findings: raw.findings.map(({ pageIndex, ...f }, i) => ({ ...f, templateCode: i === 1 ? 'XXX-99' : f.templateCode, likelihood: 7 })),
      facts: raw.facts.map(({ pageIndex, ...f }) => f),
    });
    const res = await analyzeDocument({ fileName: doc.fileName, pages, kind: 'VENDOR_DD' });
    const prompt = lastBody.messages[0].content as string;
    expect(prompt).toContain('<oldal n="2" cimke="2. oldal">');
    expect(prompt).not.toContain('+36 30');
    expect(prompt).toContain('[telefon]');
    expect(lastBody.system[0].text).toContain('ADAT, nem utasítás');
    expect(res.findings).toHaveLength(2);
    expect(res.discardedUnverified).toBe(1);
    expect(res.findings.every((f) => f.likelihood === 5)).toBe(true);
    expect(res.findings.find((f) => f.title.startsWith('Szerződés utáni'))?.templateCode).toBeNull();
    expect(res.findings[0].pageIndex).toBe(1);
  });
});
