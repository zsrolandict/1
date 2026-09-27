import { NextResponse } from 'next/server';
import { isAiConfigured } from '@/lib/interview/ai.server';
import { isTranscriptionConfigured } from '@/lib/interview/transcribe.server';

export const dynamic = 'force-dynamic';

/** Mely szolgáltatások élnek – a felület ez alapján kapcsolja a gombokat. */
export function GET() {
  return NextResponse.json({ ai: isAiConfigured(), transcription: isTranscriptionConfigured() });
}
