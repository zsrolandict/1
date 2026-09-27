import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { AiRefusalError } from '@/lib/interview/ai.server';

/** Egységes, felhasználóbarát hibaválasz; a részleteket csak a szerver naplózza. */
export function errorResponse(err: unknown): NextResponse {
  console.error('[interviews]', err);
  if (err instanceof AiRefusalError) {
    return NextResponse.json({ error: 'Az AI nem dolgozta fel a kérést. Kérjük, ellenőrizze kézzel.' }, { status: 422 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: 'Az AI-szolgáltatás túlterhelt, próbálja újra egy perc múlva.' }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: 'Érvénytelen AI API-kulcs a szerveren.' }, { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json({ error: `AI-szolgáltatás hiba (${err.status ?? 'hálózat'}).` }, { status: 502 });
  }
  const message = err instanceof Error ? err.message : 'Ismeretlen hiba.';
  return NextResponse.json({ error: message }, { status: 500 });
}
