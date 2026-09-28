import type { z } from 'zod';
import type { AiBackend, AiStatus } from '@/lib/ai/backend';
import { toJsonSchema } from '@/lib/ai/schema';
import type { StructuredCall } from '@/lib/ai/structured';
import { extractDocument } from '@/lib/intake/documents/extract.server';
import { analyzeExtracted } from '@/lib/intake/documents/pipeline';
import { buildInterviewGuide } from '@/lib/interview/guide';
import { runInterviewAnalysis, runQuestionSuggestions } from '@/lib/interview/prompts';

/**
 * Böngészős előnézet: az AI a claude.ai beépített képessége (`sample`),
 * a néző saját fiókján, API-kulcs nélkül. Az első hívásnál a claude.ai
 * engedélyt kér. Hangot ez az út nem fogad, és az oldal nem érheti el a
 * külső leiratkészítőt, ezért a hangfeldolgozás itt nem elérhető.
 */

interface SampleError {
  code: string;
  message: string;
}
type SampleFn = ((input: string, opts?: object) => Promise<{ text: string }>) & {
  json: (input: string, opts?: object) => Promise<unknown>;
};
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

let samplePromise: Promise<SampleFn | null> | null = null;
function getSample(): Promise<SampleFn | null> {
  samplePromise ??= (window.claude?.use('sample') ?? Promise.resolve(null)).then((s) => (s as SampleFn | null) ?? null);
  return samplePromise;
}

/** A claude.ai 64 KiB-os bemeneti korlátja alatt maradunk. */
const MAX_PROMPT_BYTES = 60_000;

const MESSAGES: Record<string, string> = {
  not_granted: 'Az AI használatát ennél az oldalnál nem engedélyezted. Töltsd újra az oldalt, és engedélyezd.',
  sampling_disabled: 'A claude.ai AI ebben a fiókban nem érhető el.',
  rate_limited: 'Túl sok AI-kérés vagy elfogyott a keret. Próbáld újra később.',
  session_expired: 'Lejárt a claude.ai-bejelentkezés. Jelentkezz be újra.',
  prompt_too_large: 'A szöveg túl hosszú egy elemzéshez. Rövidítsd vagy bontsd részekre.',
  refused: 'Az AI nem dolgozta fel ezt a kérést. Ellenőrizd kézzel.',
  invalid_json: 'Az AI-válasz nem értelmezhető. Próbáld újra.',
  empty_completion: 'Az AI nem adott választ. Próbáld újra rövidebb szöveggel.',
};

const sampleCall: StructuredCall = async <T extends z.ZodType>(schema: T, system: string, user: string) => {
  const sample = await getSample();
  if (!sample) throw new Error('Az AI ebben a nézetben nem érhető el (a claude.ai-ban nyisd meg az oldalt).');
  const prompt = `${system}

${user}

KIMENET: válaszolj kizárólag egyetlen JSON objektummal, magyarázat nélkül, amely pontosan megfelel ennek a JSON-sémának:
${JSON.stringify(toJsonSchema(schema))}`;
  if (new TextEncoder().encode(prompt).length > MAX_PROMPT_BYTES) throw new Error(MESSAGES.prompt_too_large);
  let data: unknown;
  try {
    data = await sample.json(prompt, { modelTier: 'default' });
  } catch (e) {
    const code = (e as SampleError)?.code;
    throw new Error(MESSAGES[code] ?? 'Az AI-szolgáltatás átmenetileg nem érhető el. Próbáld újra.');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error('Az AI-válasz formátuma eltér a várttól. Próbáld újra.');
  return parsed.data as z.infer<T>;
};

const TRANSCRIPTION_NOTE =
  'A böngészős változatban hangfájl nem dolgozható fel: az oldal nem érheti el a leiratkészítő szolgáltatást. ' +
  'Itt illeszd be a jegyzetet (az AI-elemzés működik); hangfelvételhez futtasd a programot a saját gépeden a Gemini-kulccsal.';

export const sampleBackend: AiBackend = {
  async status(): Promise<AiStatus> {
    const ok = Boolean(await getSample());
    return { ai: ok, documents: ok, transcription: false, aiProvider: ok ? 'claude.ai' : null, transcriptionNote: TRANSCRIPTION_NOTE };
  },
  async suggestQuestions(context) {
    return runQuestionSuggestions(sampleCall, context, buildInterviewGuide(context));
  },
  async transcribe() {
    throw new Error(TRANSCRIPTION_NOTE);
  },
  async analyzeInterview(req) {
    return runInterviewAnalysis(sampleCall, req);
  },
  async analyzeDocument(file, kind) {
    if (file.size > 20 * 1024 * 1024) throw new Error('A dokumentum túl nagy (max. 20 MB).');
    const doc = await extractDocument(file.name, new Uint8Array(await file.arrayBuffer()));
    // A claude.ai bemeneti korlátja miatt itt kb. 40 ezer karakter fér egy elemzésbe.
    return analyzeExtracted(sampleCall, doc, kind, { maxChars: 40_000, maxPages: 60 });
  },
};
