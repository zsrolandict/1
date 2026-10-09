import { NextResponse } from 'next/server';
import { requireStaff, supabaseServer } from '@/lib/auth/guard.server';
import { CreateProjectSchema, summaryFromRow, type EngagementListRow } from '@/lib/server/projects';
import { saveErrorStatus } from '@/lib/server/saveAssessment';
import { limitWrites, readJsonLimited } from '@/lib/server/body';

const NO_STORE = { 'Cache-Control': 'no-store' };
const notServer = () => NextResponse.json({ error: 'A szerveres projekttárolás csak bejelentkezett, éles módban érhető el.' }, { status: 503 });

/** A bejelentkezett felhasználó projektjei (az RLS szerint: partner mindet, más a tagságait). */
export async function GET() {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  if (access.mode !== 'SUPABASE') return notServer();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('engagements')
    .select('id, code, kind, revision, updated_at, companies(name)')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: 'A projektlista nem tölthető be.' }, { status: 500 });
  return NextResponse.json({ projects: (data as unknown as EngagementListRow[]).map(summaryFromRow) }, { headers: NO_STORE });
}

/** Új projekt a szerveren (partner, projektvezető): cég, projekt és tagság egy lépésben. */
export async function POST(req: Request) {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  if (access.mode !== 'SUPABASE') return notServer();
  const limited = await limitWrites();
  if (limited) return limited;
  const parsed = CreateProjectSchema.safeParse(await readJsonLimited(req, 16 * 1024));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás projektadat (cégnév, típus).' }, { status: 400 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('create_engagement', {
    p_company_name: parsed.data.companyName,
    p_kind: parsed.data.kind,
    p_materiality: parsed.data.materialityHuf ?? 50_000_000,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === '42501') return NextResponse.json({ error: 'Új projektet partner vagy projektvezető hozhat létre.' }, { status: 403 });
    return NextResponse.json(
      { error: saveErrorStatus(code).status === 400 ? 'Hibás projektadat.' : 'A projekt nem hozható létre.' },
      { status: saveErrorStatus(code).status },
    );
  }
  return NextResponse.json({ id: data as string, revision: 0 }, { status: 201, headers: NO_STORE });
}
