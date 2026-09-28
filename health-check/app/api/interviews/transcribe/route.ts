import { NextResponse } from 'next/server';
import { MAX_AUDIO_BYTES } from '@/lib/interview/schemas';
import { transcriptionProvider } from '@/lib/interview/transcribe.server';
import { requireStaff } from '@/lib/auth/guard.server';
import { errorResponse } from '../../_errors';

export const maxDuration = 300;

/**
 * Hangfájl → leirat. Hozzájárulás nélkül nem dolgozunk fel felvételt,
 * és a hangot nem tároljuk: csak a leirat megy vissza a kliensnek.
 */
export async function POST(req: Request) {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  const provider = transcriptionProvider();
  if (!provider) {
    return NextResponse.json({ error: 'A leiratkészítés nincs beállítva (GEMINI_API_KEY vagy AZURE_SPEECH_KEY + AZURE_SPEECH_REGION).' }, { status: 503 });
  }
  const form = await req.formData().catch(() => null);
  const audio = form?.get('audio');
  if (!(audio instanceof Blob)) return NextResponse.json({ error: 'Hiányzó hang- vagy videófájl.' }, { status: 400 });
  if (form?.get('consent') !== 'true') {
    return NextResponse.json({ error: 'A felvétel feldolgozásához az interjúalany hozzájárulása szükséges.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'A felvétel túl nagy (max. 200 MB). Bontsa részekre.' }, { status: 413 });
  }
  const speakers = Math.min(6, Math.max(2, Number(form.get('speakers')) || 2));
  const name = audio instanceof File ? audio.name : 'interju.wav';
  try {
    const transcript = await provider.transcribe(audio, name, { maxSpeakers: speakers });
    if (!transcript.segments.length) {
      return NextResponse.json({ error: 'A felvételen nem ismerhető fel beszéd.' }, { status: 422 });
    }
    return NextResponse.json({ transcript });
  } catch (err) {
    return errorResponse(err);
  }
}
