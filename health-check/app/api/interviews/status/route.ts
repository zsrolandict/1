import { NextResponse } from 'next/server';
import { isAiConfigured } from '@/lib/interview/ai.server';
import { transcriptionProvider } from '@/lib/interview/transcribe.server';
import { aiProvider } from '@/lib/ai/client.server';
import { authMode } from '@/lib/auth/mode';
import { dataPolicy } from '@/lib/ai/policy';
import { requireStaff } from '@/lib/auth/guard.server';

export const dynamic = 'force-dynamic';

/**
 * Mely szolgáltatások élnek – a felület ez alapján kapcsolja a gombokat.
 * Részletet (szolgáltató neve, hitelesítési mód) csak belső felhasználó
 * kap; bejelentkezés nélkül csak azt, hogy elérhető-e.
 */
export async function GET() {
  // Zárt módban a felület a funkciókat kikapcsoltként mutatja.
  const mode = authMode();
  // Éles módban DPA-megerősítés nélkül az AI zárva (lásd lib/ai/policy.ts).
  const open = mode !== 'LOCKED' && dataPolicy().ok;
  const staff = open && (await requireStaff()).ok;
  const t = staff ? transcriptionProvider() : null;
  if (!staff) return NextResponse.json({ ai: false, documents: false, transcription: false });
  return NextResponse.json({
    ai: isAiConfigured(),
    documents: isAiConfigured(),
    transcription: Boolean(t),
    aiProvider: aiProvider(),
    transcriptionProvider: t?.id ?? null,
    transcriptionAccept: t?.accept ?? 'audio/*',
    auth: mode,
  });
}
