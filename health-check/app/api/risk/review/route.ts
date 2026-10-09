import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi, supabaseServer } from '@/lib/auth/guard.server';
import { supabaseServiceRole } from '@/lib/auth/serviceRole.server';
import type { RedFlagRow } from '@/lib/server/redFlagRow';
import { reviewRequestFromRow, type EngagementRow } from '@/lib/server/reviewFromDb';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';
import { opinionEntry, reviewEntry, runOpinionReview } from '@/lib/risk/review';
import { errorResponse } from '../../_errors';

export const maxDuration = 120;

const S = (max: number) => z.string().max(max);
const RequestSchema = z.object({
  kind: EngagementKindSchema,
  item: z.object({
    code: S(40),
    title: S(300),
    pillar: z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']),
    description: S(2000),
    reasoning: S(6000),
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    exposureHuf: z.number().finite().nonnegative(),
    exposureExplanation: S(1000),
    rag: S(20),
  }),
  derivation: z.array(z.object({ label: S(100), value: S(400) })).max(20),
  evidence: z.array(z.object({ id: S(80), kind: S(60), ref: S(2000), quote: S(4000).optional(), rationale: S(4000).optional() })).max(40),
  thread: z.array(z.object({ role: z.enum(['EXPERT', 'AI']), text: S(4000) })).max(12),
  opinion: z.string().min(3).max(4000),
});

/** Éles kérés: csak a tétel azonosítója és a vélemény – minden más az adatbázisból jön. */
const ServerRequestSchema = z.object({
  engagementId: z.string().uuid(),
  itemKey: z.string().min(1).max(200),
  opinion: z.string().trim().min(3).max(4000),
});

/**
 * Szakértői vélemény kritikus felülvizsgálata a tétel forrásai és levezetése alapján.
 * Éles (Supabase) módban zéró bizalom a kliensben (audit K8, K9): a tételt, a
 * forrásokat és a levezetést a szerver olvassa az adatbázisból a felhasználó
 * saját, RLS-es kapcsolatán (amihez nincs joga, azt nem is látja); a véleményt a
 * felhasználó nevében, az AI-felülvizsgálatot service role-lal rögzíti – a kliens
 * AI-bejegyzést nem tud írni (0014 trigger). Fejlesztői (DEMO) módban, adatbázis
 * nélkül, a régi, kliens által összeállított kérés is elfogadott.
 */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  try {
    if (access.mode !== 'SUPABASE') {
      const parsed = RequestSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });
      return NextResponse.json({ review: await runOpinionReview(parseStructured, parsed.data) });
    }
    const parsed = ServerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Hibás kérés: éles módban csak a tétel azonosítója és a vélemény küldhető; a forrásokat a szerver olvassa.' },
        { status: 400 },
      );
    }
    const admin = supabaseServiceRole();
    if (!admin) return NextResponse.json({ error: 'A szerver nincs beállítva a felülvizsgálat rögzítésére (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
    const supabase = await supabaseServer();
    const { data: row } = await supabase
      .from('red_flags')
      .select('*, engagements(kind, materiality_huf, workspace)')
      .eq('engagement_id', parsed.data.engagementId)
      .eq('item_key', parsed.data.itemKey)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Nincs ilyen tétel, vagy nincs hozzá jogosultság.' }, { status: 404 });
    const { engagements: eng, ...flag } = row as RedFlagRow & { engagements: EngagementRow };
    const review = await runOpinionReview(parseStructured, reviewRequestFromRow(flag, eng, parsed.data.opinion));
    // A vélemény a felhasználó nevében (a trigger bélyegzi a szerzőt és az időt) …
    const opinion = opinionEntry(parsed.data.opinion, null);
    const { error: e1 } = await supabase
      .from('red_flags')
      .update({ discussion: [...(flag.discussion ?? []), opinion] })
      .eq('id', flag.id);
    if (e1) return NextResponse.json({ error: 'A vélemény nem rögzíthető (jogosultság vagy közben módosult tétel).' }, { status: 409 });
    // … az AI-felülvizsgálat csak service role-lal.
    const ai = reviewEntry(review);
    const { error: e2 } = await admin.rpc('append_ai_review', { p_red_flag: flag.id, p_entry: ai });
    if (e2) return NextResponse.json({ error: 'A felülvizsgálat nem rögzíthető.' }, { status: 500 });
    // A rögzített bejegyzések (azonos azonosítóval): a kliens ezeket veszi át, így a következő mentése egyezik a tárolttal.
    return NextResponse.json({ review, entries: [opinion, ai] });
  } catch (err) {
    return errorResponse(err);
  }
}
