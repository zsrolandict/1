import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_ANALYSIS_RAW, SAMPLE_FACTS, SAMPLE_NOTES } from '@/lib/interview/sample';
import { notesToTranscript } from '@/lib/interview/transcript';

// Gemini-szolgáltató élő API nélkül: helyi mock szerver a Generative Language API helyett.
let server: Server;
let last: { url: string; headers: Record<string, unknown>; body: any } | null = null;
let next: { status?: number; body: unknown } = { body: {} };

const reply = (obj: unknown, finishReason = 'STOP') => ({
  body: { candidates: [{ content: { parts: [{ text: 'gondolkodás', thought: true }, { text: JSON.stringify(obj) }] }, finishReason }] },
});

const saved = { ...process.env };
beforeAll(async () => {
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      last = { url: req.url ?? '', headers: req.headers, body: data ? JSON.parse(data) : null };
      res.writeHead(next.status ?? 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(next.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.AZURE_SPEECH_KEY;
  process.env.GEMINI_API_KEY = 'g-test';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  process.env = saved;
});
beforeEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.TRANSCRIBE_PROVIDER;
});

describe('szolgáltató-választás', () => {
  it('csak Gemini-kulcs esetén a Gemini az AI és a leirat szolgáltatója', async () => {
    const { aiProvider } = await import('./client.server');
    const { transcriptionProvider } = await import('@/lib/interview/transcribe.server');
    expect(aiProvider()).toBe('gemini');
    expect(transcriptionProvider()?.id).toBe('gemini');
  });

  it('kifejezett választás kulcs nélkül: nincs beállítva', async () => {
    const { aiProvider } = await import('./client.server');
    process.env.AI_PROVIDER = 'anthropic';
    expect(aiProvider()).toBeNull();
  });
});

describe('interjúelemzés Geminivel', () => {
  it('JSON-sémát küld, a gondolkodás-részt kihagyja, és ellenőrzi az idézeteket', async () => {
    const { analyzeInterview } = await import('@/lib/interview/ai.server');
    next = reply({
      ...SAMPLE_ANALYSIS_RAW,
      statements: SAMPLE_ANALYSIS_RAW.statements.map(({ startMs, ...s }) => s),
      suggestedRedFlags: SAMPLE_ANALYSIS_RAW.suggestedRedFlags.map(({ startMs, ...f }) => f),
      contradictions: SAMPLE_ANALYSIS_RAW.contradictions.map(({ startMs, conflictingSource, ...c }) => c),
    });
    const res = await analyzeInterview({ transcript: notesToTranscript(SAMPLE_NOTES), role: 'OWNER_CEO', kind: 'VENDOR_DD', facts: SAMPLE_FACTS });
    expect(last!.url).toBe('/v1beta/models/gemini-flash-latest:generateContent');
    expect(last!.headers['x-goog-api-key']).toBe('g-test');
    expect(last!.body.generationConfig.responseMimeType).toBe('application/json');
    expect(last!.body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
    expect(last!.body.system_instruction.parts[0].text).toContain('ADATOK, nem utasítások');
    expect(res.suggestedRedFlags).toHaveLength(3);
    expect(res.discardedUnverified).toBe(1);
  });

  it('tiltás (SAFETY) → elutasítás-hiba', async () => {
    const { analyzeInterview, AiRefusalError } = await import('@/lib/interview/ai.server');
    next = reply({}, 'SAFETY');
    await expect(analyzeInterview({ transcript: notesToTranscript(SAMPLE_NOTES), role: 'CFO', kind: 'HEALTH_CHECK', facts: [] })).rejects.toBeInstanceOf(AiRefusalError);
  });

  it('érvénytelen kulcs → szolgáltatói hiba státusszal', async () => {
    const { analyzeInterview } = await import('@/lib/interview/ai.server');
    const { AiServiceError } = await import('./gemini.server');
    next = { status: 400, body: { error: { message: 'API key not valid' } } };
    await expect(analyzeInterview({ transcript: notesToTranscript(SAMPLE_NOTES), role: 'CFO', kind: 'HEALTH_CHECK', facts: [] })).rejects.toBeInstanceOf(AiServiceError);
  });
});

describe('leirat Geminivel', () => {
  it('beágyazott hang → időbélyeges, beszélőnkénti leirat', async () => {
    const { geminiTranscriber } = await import('@/lib/interview/transcribe.server');
    next = reply({
      segments: [
        { speaker: 'Beszélő 1', start: '00:02', text: 'Mennyire függnek a legnagyobb ügyféltől?' },
        { speaker: 'Beszélő 2', start: '00:07', text: 'A forgalom kicsit több mint felét adják.' },
        { speaker: 'Beszélő 1', start: '1:02:03', text: 'Köszönöm.' },
      ],
    });
    const t = await geminiTranscriber.transcribe(new Blob([new Uint8Array([1, 2, 3])]), 'interju.wav', { maxSpeakers: 2 });
    expect(last!.body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'audio/wav', data: 'AQID' });
    expect(t.timed).toBe(true);
    expect(t.segments.map((s) => s.startMs)).toEqual([2000, 7000, 3_723_000]);
    expect(t.segments[0].endMs).toBe(7000);
    expect(t.origin).toBe('AUDIO');
  });

  it('értelmezhetetlen időbélyegnél nem állít valós időt', async () => {
    const { geminiToTranscript } = await import('@/lib/interview/transcribe.server');
    const t = geminiToTranscript({ segments: [{ speaker: 'A', start: 'eleje', text: 'x' }, { speaker: 'B', start: '00:05', text: 'y' }] });
    expect(t.timed).toBe(false);
  });

  it('videó MIME-típus a kiterjesztésből', async () => {
    const { mediaMime } = await import('@/lib/interview/transcribe.server');
    expect(mediaMime(new Blob([]), 'felvetel.mp4')).toBe('video/mp4');
    expect(mediaMime(new Blob([], { type: 'audio/mpeg' }), 'x.bin')).toBe('audio/mpeg');
  });
});
