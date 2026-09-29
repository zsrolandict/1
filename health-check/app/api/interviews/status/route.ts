import { NextResponse } from 'next/server';
import { isAiConfigured } from '@/lib/interview/ai.server';
import { transcriptionProvider } from '@/lib/interview/transcribe.server';
import { aiProvider } from '@/lib/ai/client.server';
import { authMode } from '@/lib/auth/mode';
import { dataPolicy } from '@/lib/ai/policy';

export const dynamic = 'force-dynamic';

/** Mely szolgáltatások élnek – a felület ez alapján kapcsolja a gombokat. */
export function GET() {
  // Zárt módban a felület a funkciókat kikapcsoltként mutatja.
  const mode = authMode();
  // Éles módban DPA-megerősítés nélkül az AI zárva (lásd lib/ai/policy.ts).
  const open = mode !== 'LOCKED' && dataPolicy().ok;
  const t = open ? transcriptionProvider() : null;
  return NextResponse.json({
    ai: open && isAiConfigured(),
    documents: open && isAiConfigured(),
    transcription: Boolean(t),
    aiProvider: open ? aiProvider() : null,
    transcriptionProvider: t?.id ?? null,
    transcriptionAccept: t?.accept ?? 'audio/*',
    auth: mode,
  });
}
