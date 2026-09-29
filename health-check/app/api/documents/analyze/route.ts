import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi } from '@/lib/auth/guard.server';
import { extractDocument } from '@/lib/intake/documents/extract.server';
import { analyzeExtracted } from '@/lib/intake/documents/pipeline';
import { errorResponse } from '../../_errors';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';

export const maxDuration = 300;

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 300_000;
const MAX_PAGES = 300;

const Kind = EngagementKindSchema;

/**
 * Dokumentum → ellenőrzött kockázati javaslatok.
 * A fájlt nem tároljuk: memóriában kinyerjük a szöveget, maszkoljuk a
 * személyes azonosítókat, és csak az ellenőrzött eredmény megy vissza.
 */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = Kind.safeParse(form?.get('kind'));
  if (!(file instanceof File) || !kind.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: 'A dokumentum túl nagy (max. 20 MB).' }, { status: 413 });
  }
  try {
    const extracted = await extractDocument(file.name, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json(await analyzeExtracted(parseStructured, extracted, kind.data, { maxChars: MAX_DOCUMENT_CHARS, maxPages: MAX_PAGES }));
  } catch (err) {
    return errorResponse(err);
  }
}
