import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { AiRefusalError } from '@/lib/ai/client.server';
import { AiServiceError } from '@/lib/ai/gemini.server';
import { UserFacingError } from '@/lib/errors';

/** Egységes, felhasználóbarát hibaválasz; a részleteket csak a szerver naplózza. */
export function errorResponse(err: unknown): NextResponse {
  console.error('[api]', err);
  if (err instanceof AiRefusalError) {
    return NextResponse.json({ error: 'Az AI nem dolgozta fel a kérést. Kérjük, ellenőrizze kézzel.' }, { status: 422 });
  }
  if (err instanceof AiServiceError) {
    if (err.status === 429) return NextResponse.json({ error: 'Az AI-szolgáltatás túlterhelt vagy elfogyott a keret, próbálja újra később.' }, { status: 429 });
    if (err.status === 400 && /api key/i.test(err.message)) return NextResponse.json({ error: 'Érvénytelen AI API-kulcs a szerveren.' }, { status: 500 });
    if (err.status === 401 || err.status === 403) return NextResponse.json({ error: 'Érvénytelen vagy nem jogosult AI API-kulcs a szerveren.' }, { status: 500 });
    if (err.status === 404) return NextResponse.json({ error: 'A beállított AI-modell nem elérhető (GEMINI_MODEL).' }, { status: 502 });
    return NextResponse.json({ error: `AI-szolgáltatás hiba (${err.status}).` }, { status: 502 });
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
  // Csak a szándékosan felhasználónak szánt üzenet mehet ki; a többi (könyvtári
  // hibák, útvonalak, szolgáltatói részletek) csak a naplóba.
  if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 422 });
  return NextResponse.json({ error: 'Váratlan hiba történt a feldolgozás közben. Próbálja újra, vagy jelezze a rendszergazdának.' }, { status: 500 });
}
