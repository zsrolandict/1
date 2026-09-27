import { NextResponse } from 'next/server';
import { isAiConfigured } from '@/lib/interview/ai.server';
import { isTranscriptionConfigured } from '@/lib/interview/transcribe.server';
import { authMode } from '@/lib/auth/mode';

export const dynamic = 'force-dynamic';

/** Mely szolgáltatások élnek – a felület ez alapján kapcsolja a gombokat. */
export function GET() {
  // Zárt módban a felület a funkciókat kikapcsoltként mutatja.
  const mode = authMode();
  const open = mode !== 'LOCKED';
  return NextResponse.json({ ai: open && isAiConfigured(), transcription: open && isTranscriptionConfigured(), auth: mode });
}
