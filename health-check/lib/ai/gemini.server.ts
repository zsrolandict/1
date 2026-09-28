import { z } from 'zod';

// Google Gemini (Generative Language API) – közvetlen REST-hívás, SDK nélkül.
// Csak szerveroldalon importálható: az API-kulcs nem kerülhet a kliensre.
//
// Környezeti változók:
//   GEMINI_API_KEY (vagy GOOGLE_API_KEY)  – kötelező
//   GEMINI_MODEL                          – alapértelmezés: gemini-flash-latest (a legújabb Flash)
//   GEMINI_BASE_URL                       – tesztekhez / proxyhoz

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-flash-latest';
}

function base(): string {
  return (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
}

/** Szolgáltatói hiba HTTP-státusszal (a felületen barátságos üzenet lesz belőle). */
export class AiServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class GeminiBlockedError extends Error {}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { mime_type: string; file_uri: string } };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const key = geminiKey();
  if (!key) throw new AiServiceError(500, 'A Gemini nincs beállítva (GEMINI_API_KEY).');
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { 'x-goog-api-key': key, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiServiceError(res.status, `Gemini hiba (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Zod → a Gemini által elfogadott JSON-séma (a felesleges meta-mezők nélkül). */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema') continue;
      if ((k === 'minimum' || k === 'maximum') && Math.abs(v as number) >= Number.MAX_SAFE_INTEGER) continue;
      out[k] = strip(v);
    }
    return out;
  };
  return strip(z.toJSONSchema(schema));
}

/**
 * Strukturált (JSON) válasz kérése. Elutasítás / tiltás esetén
 * GeminiBlockedError; csonka válasznál hiba.
 */
export async function geminiJson(opts: {
  system: string;
  parts: GeminiPart[];
  schema: z.ZodType;
  maxTokens: number;
}): Promise<unknown> {
  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: toGeminiSchema(opts.schema),
      maxOutputTokens: opts.maxTokens,
    },
  };
  const res = await call<GeminiResponse>(`/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.promptFeedback?.blockReason) throw new GeminiBlockedError(res.promptFeedback.blockReason);
  const cand = res.candidates?.[0];
  const reason = cand?.finishReason;
  if (reason && ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(reason)) {
    throw new GeminiBlockedError(reason);
  }
  if (reason === 'MAX_TOKENS') throw new Error('Az AI-válasz hiányos (túl hosszú bemenet?). Bontsa részekre.');
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Az AI-válasz nem értelmezhető.');
  }
}

/** A kérésbe közvetlenül beágyazható méret; efölött a Files API-t használjuk. */
const INLINE_LIMIT = 15 * 1024 * 1024;

/**
 * Médiafájl átadása. Kis fájl: beágyazva. Nagy fájl: Files API, és a
 * `cleanup` a feldolgozás után törli (nem hagyjuk a szolgáltatónál).
 */
export async function geminiMedia(blob: Blob, mime: string, name: string): Promise<{ part: GeminiPart; cleanup: () => Promise<void> }> {
  if (blob.size <= INLINE_LIMIT) {
    const data = Buffer.from(await blob.arrayBuffer()).toString('base64');
    return { part: { inline_data: { mime_type: mime, data } }, cleanup: async () => {} };
  }
  const key = geminiKey();
  if (!key) throw new AiServiceError(500, 'A Gemini nincs beállítva (GEMINI_API_KEY).');
  const start = await fetch(`${base()}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name.slice(0, 100) } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new AiServiceError(start.status || 502, 'A fájl feltöltése a Geminihez nem sikerült.');
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: blob,
  });
  if (!up.ok) throw new AiServiceError(up.status, 'A fájl feltöltése a Geminihez nem sikerült.');
  let file = ((await up.json()) as { file: { name: string; uri: string; state?: string } }).file;
  for (let i = 0; i < 60 && file.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await call(`/v1beta/${file.name}`, { method: 'GET' });
  }
  if (file.state === 'FAILED') throw new AiServiceError(422, 'A Gemini nem tudta feldolgozni a fájlt.');
  return {
    part: { file_data: { mime_type: mime, file_uri: file.uri } },
    cleanup: async () => {
      await fetch(`${base()}/v1beta/${file.name}`, { method: 'DELETE', headers: { 'x-goog-api-key': key } }).catch(() => {});
    },
  };
}
