import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff, supabaseServer } from '@/lib/auth/guard.server';
import { limitWrites, readJsonLimited, tooLarge } from '@/lib/server/body';
import { prepareSave, SaveRequestSchema, saveErrorStatus, type EngagementForSave } from '@/lib/server/saveAssessment';

/**
 * Atomikus mentés (audit K13): tételek, kérdőív-válaszok, iratállapot,
 * munkaterület-adat és riportrekord EGY adatbázis-tranzakcióban
 * (`save_assessment`, 0014). Bármely hiba vagy verzióütközés esetén semmi nem
 * íródik. Az értékelést a szerver számolja; a napló-bejegyzések szerzőjét és
 * idejét az adatbázis bélyegzi.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  if (access.mode !== 'SUPABASE') return NextResponse.json({ error: 'A szerveres mentés csak bejelentkezett, éles módban érhető el.' }, { status: 503 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Hibás projektazonosító.' }, { status: 400 });
  const limited = await limitWrites();
  if (limited) return limited;
  const raw = await readJsonLimited(req);
  if (raw === 'too_large') return tooLarge();
  const parsed = SaveRequestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen mentési adat – semmi nem módosult.' }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: eng } = await supabase.from('engagements').select('kind, materiality_huf, case_profile').eq('id', id).maybeSingle();
  if (!eng) return NextResponse.json({ error: 'Nincs ilyen projekt, vagy nincs hozzá jogosultság.' }, { status: 404 });

  const { args, invalidAnswers } = prepareSave(id, parsed.data, eng as EngagementForSave);
  const { data, error } = await supabase.rpc('save_assessment', args);
  if (error) {
    const { status, error: message } = saveErrorStatus((error as { code?: string }).code);
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ revision: data, assessment: args.p_snapshot, invalidAnswers }, { headers: { 'Cache-Control': 'no-store' } });
}
