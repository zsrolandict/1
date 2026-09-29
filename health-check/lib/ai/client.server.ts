import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { geminiJson, GeminiBlockedError, geminiKey } from './gemini.server';
import { UserFacingError } from '@/lib/errors';

// Közös AI-hívás az interjú- és a dokumentumelemzéshez, szolgáltató-függetlenül.
// Csak szerveroldalon (route handler) importálható: az API-kulcs nem kerülhet a kliensre.
//
// Szolgáltató: AI_PROVIDER=anthropic | gemini. Ha nincs megadva, az elérhető
// kulcs dönt (Anthropic elsőbbséggel). Új szolgáltató = egy új ág a parseStructured-ben.

export const MODEL = 'claude-opus-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export type AiProvider = 'anthropic' | 'gemini';

const hasAnthropic = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export function aiProvider(): AiProvider | null {
  const wanted = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (wanted === 'gemini') return geminiKey() ? 'gemini' : null;
  if (wanted === 'anthropic') return hasAnthropic() ? 'anthropic' : null;
  if (hasAnthropic()) return 'anthropic';
  if (geminiKey()) return 'gemini';
  return null;
}

export function isAiConfigured(): boolean {
  return aiProvider() !== null;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AiRefusalError extends Error {}

/**
 * Strukturált (JSON-sémás) válasz kérése. A rendszerprompt cache-elt,
 * mert kérésenként nem változik.
 */
export async function parseStructured<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens: number): Promise<z.infer<T>> {
  if (aiProvider() === 'gemini') {
    let json: unknown;
    try {
      json = await geminiJson({ system, parts: [{ text: user }], schema, maxTokens });
    } catch (e) {
      if (e instanceof GeminiBlockedError) throw new AiRefusalError('A modell elutasította a kérést.');
      throw e;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new UserFacingError('Az AI-válasz formátuma eltér a várttól.');
    return parsed.data as z.infer<T>;
  }
  // create() + saját parse: a stop_reason-t a JSON-feldolgozás ELŐTT kell vizsgálni,
  // különben egy elutasítás (üres tartalom) parse-hibaként jelenne meg.
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') {
    throw new AiRefusalError('A modell elutasította a kérést.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new UserFacingError('Az AI-válasz hiányos (túl hosszú bemenet?). Bontsa részekre.');
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UserFacingError('Az AI-válasz nem értelmezhető.');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new UserFacingError('Az AI-válasz formátuma eltér a várttól.');
  return parsed.data as z.infer<T>;
}
