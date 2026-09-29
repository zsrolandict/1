import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi } from '@/lib/auth/guard.server';
import { runCaseSuggestion } from '@/lib/intake/casePrompts';
import { FLAG_LABEL, SECTOR_LABEL, type CaseFlag, type Sector } from '@/lib/intake/requests';
import { errorResponse } from '../../_errors';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';

export const maxDuration = 120;

const Pillar = z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']);
const Kind = EngagementKindSchema;
const RequestSchema = z.object({
  kind: Kind,
  companyName: z.string().max(200),
  profile: z.object({
    sectors: z.array(z.enum(Object.keys(SECTOR_LABEL) as [Sector, ...Sector[]])).max(7),
    headcount: z.number().int().nonnegative().nullable(),
    flags: z.array(z.enum(Object.keys(FLAG_LABEL) as [CaseFlag, ...CaseFlag[]])).max(20),
    narrative: z.string().min(20).max(20_000),
  }),
  current: z.array(
    z.object({
      id: z.string().max(40),
      title: z.string().max(300),
      pillar: Pillar,
      why: z.array(z.string().max(500)).max(10),
      source: z.enum(['BASE', 'KIND', 'SECTOR', 'SIZE', 'FLAG', 'AI', 'MANUAL']),
      priority: z.enum(['REQUIRED', 'RECOMMENDED']),
    }),
  ).max(200),
});

/** Szöveges tényállás → javasolt jellemzők és extra iratok (idézet-ellenőrzéssel). */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés (a tényállás legalább 20 karakter legyen).' }, { status: 400 });
  try {
    return NextResponse.json({ suggestion: await runCaseSuggestion(parseStructured, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}
