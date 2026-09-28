import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured } from '@/lib/ai/client.server';
import { requireStaff } from '@/lib/auth/guard.server';
import { analyzeDocument } from '@/lib/intake/documents/ai.server';
import { documentChars } from '@/lib/intake/documents/extract';
import { extractDocument } from '@/lib/intake/documents/extract.server';
import { redactPages } from '@/lib/intake/documents/redact';
import { errorResponse } from '../../_errors';

export const maxDuration = 300;

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 300_000;
const MAX_PAGES = 300;

const Kind = z.enum(['HEALTH_CHECK', 'VENDOR_DD', 'BUY_SIDE_DD', 'FINANCING_READINESS', 'SUCCESSION', 'COMPLIANCE_AUDIT', 'POST_MERGER']);

/**
 * Dokumentum → ellenőrzött kockázati javaslatok.
 * A fájlt nem tároljuk: memóriában kinyerjük a szöveget, maszkoljuk a
 * személyes azonosítókat, és csak az ellenőrzött eredmény megy vissza.
 */
export async function POST(req: Request) {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY).' }, { status: 503 });
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
    if (extracted.pages.length > MAX_PAGES || documentChars(extracted.pages) > MAX_DOCUMENT_CHARS) {
      return NextResponse.json({ error: 'A dokumentum túl hosszú egy elemzéshez. Töltse fel részenként.' }, { status: 413 });
    }
    const { pages, counts } = redactPages(extracted.pages);
    const analysis = await analyzeDocument({ fileName: file.name, pages, kind: kind.data });
    return NextResponse.json({
      analysis,
      format: extracted.format,
      pageLabels: pages.map((p) => p.label),
      redactions: counts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
