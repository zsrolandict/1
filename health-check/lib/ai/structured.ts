import type { z } from 'zod';

/**
 * Egy strukturált AI-hívás: rendszerprompt + kérés → a sémának megfelelő adat.
 * A szerveren az API-kulcsos szolgáltató (lib/ai/client.server.ts), a böngészős
 * előnézetben a claude.ai beépített AI-ja adja (preview/sampleBackend.ts).
 */
export type StructuredCall = <T extends z.ZodType>(schema: T, system: string, user: string, maxTokens: number) => Promise<z.infer<T>>;
