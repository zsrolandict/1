import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff, supabaseServer } from '@/lib/auth/guard.server';
import type { RedFlagRow } from '@/lib/server/redFlagRow';
import { projectFromRows, type EngagementFullRow } from '@/lib/server/projects';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function prepare(ctx: { params: Promise<{ id: string }> }) {
  const access = await requireStaff();
  if (!access.ok) return { response: access.response };
  if (access.mode !== 'SUPABASE') {
    return { response: NextResponse.json({ error: 'A szerveres projekttárolás csak bejelentkezett, éles módban érhető el.' }, { status: 503 }) };
  }
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return { response: NextResponse.json({ error: 'Hibás projektazonosító.' }, { status: 400 }) };
  return { id, supabase: await supabaseServer() };
}

/** Egy projekt teljes betöltése (munkaállapot, tételek, kérdőív, moduladatok) az RLS-en át. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepare(ctx);
  if ('response' in p) return p.response;
  const { id, supabase } = p;
  const { data: eng } = await supabase
    .from('engagements')
    .select('id, code, kind, revision, updated_at, materiality_huf, workspace, companies(name)')
    .eq('id', id)
    .maybeSingle();
  if (!eng) return NextResponse.json({ error: 'Nincs ilyen projekt, vagy nincs hozzá jogosultság.' }, { status: 404 });
  const [flags, answers, modules] = await Promise.all([
    supabase.from('red_flags').select('*').eq('engagement_id', id),
    supabase.from('engagement_answers').select('answers, request_status').eq('engagement_id', id).maybeSingle(),
    supabase.from('engagement_modules').select('module, data').eq('engagement_id', id),
  ]);
  if (flags.error || answers.error || modules.error) return NextResponse.json({ error: 'A projekt nem tölthető be.' }, { status: 500 });
  const project = projectFromRows(
    eng as unknown as EngagementFullRow,
    (flags.data ?? []) as RedFlagRow[],
    answers.data as { answers: unknown; request_status: unknown } | null,
    (modules.data ?? []) as { module: string; data: unknown }[],
  );
  return NextResponse.json({ project }, { headers: NO_STORE });
}

/** Projekt végleges törlése (csak partner – az RLS dönt; másnak 403). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepare(ctx);
  if ('response' in p) return p.response;
  const { data, error } = await p.supabase.from('engagements').delete().eq('id', p.id).select('id');
  if (error) return NextResponse.json({ error: 'A projekt nem törölhető (kapcsolódó elszámolás van rajta).' }, { status: 409 });
  if (!data?.length) return NextResponse.json({ error: 'Projektet csak partner törölhet.' }, { status: 403 });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
