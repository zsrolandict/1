import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { scoreRisk } from '@/lib/risk/engine';
import type { Pillar } from '@/lib/risk/types';
import { BASE_QUESTIONS, KIND_QUESTIONS, RISK_PROBES, ROLE_PILLARS } from './questionBank';
import type { GuideContext, InterviewQuestion } from './types';

/** Becsült idő / kérdés (perc), a követő kérdésekkel együtt. */
export const MINUTES_PER_QUESTION = 3;

/**
 * Szabályalapú interjúvezérfonal – AI nélkül, determinisztikusan.
 * Forrásai: az interjúalany szerepköre, az átvilágítás típusa, a már
 * azonosított red flagek, a hiányzó dokumentumok és a dokumentumokból
 * ismert tények (amelyeket az interjúban meg kell erősíttetni).
 */
export function buildInterviewGuide(ctx: GuideContext): InterviewQuestion[] {
  const profile = ENGAGEMENT_KINDS[ctx.kind];
  const rolePillars = new Set(ROLE_PILLARS[ctx.role]);
  const covers = (p: Pillar) => rolePillars.has(p);
  const out: InterviewQuestion[] = [];

  // 1. Azonosított kockázatok célzott kérdései – ezek a legértékesebbek.
  for (const risk of ctx.risks) {
    if (!risk.identified || !covers(risk.pillar)) continue;
    const { rag } = scoreRisk(risk, { adjustments: adjustmentsFor(ctx.kind) });
    const important = rag === 'RED' || profile.focusRiskCodes.includes(risk.code);
    const probes = RISK_PROBES[risk.code] ?? [
      {
        pillar: risk.pillar,
        text: `Mit tud a következőről: „${risk.title}”? Mióta áll fenn, és mit tettek eddig?`,
      },
    ];
    probes.forEach((q, i) =>
      out.push({
        id: `rf-${risk.id}-${i}`,
        pillar: q.pillar,
        text: q.text,
        listenFor: q.listenFor,
        followUps: q.followUps ?? [],
        source: { type: 'RED_FLAG', code: risk.code, title: risk.title },
        priority: important ? 1 : 2,
      }),
    );
  }

  // 2. Dokumentumokból ismert tények megerősíttetése (ellentmondás-keresés alapja).
  for (const fact of ctx.facts) {
    if (!covers(fact.pillar)) continue;
    out.push({
      id: `fact-${fact.id}`,
      pillar: fact.pillar,
      text: `A dokumentumok alapján: „${fact.statement}”. Ez így van? Kérem, mondja el a hátterét.`,
      listenFor: 'Nyitott kérdés, ne sugalljuk a választ. Az eltérést jelöljük.',
      followUps: [],
      source: { type: 'DOCUMENT_FINDING', document: fact.source, finding: fact.statement },
      priority: 2,
    });
  }

  // 3. Hiányzó dokumentumok – a pénzügyi / felsővezetői interjúban rákérdezünk.
  for (const doc of ctx.missingDocuments) {
    if (!covers(doc.pillar)) continue;
    out.push({
      id: `doc-${slug(doc.title)}`,
      pillar: doc.pillar,
      text: `A(z) „${doc.title}” még nem érkezett meg. Létezik ilyen dokumentum? Ki tudja pótolni és mikorra?`,
      followUps: [],
      source: { type: 'MISSING_DOCUMENT', title: doc.title },
      priority: 1,
    });
  }

  // 4. Szerepkör alapkérdései.
  BASE_QUESTIONS[ctx.role].forEach((q, i) =>
    out.push({
      id: `base-${ctx.role}-${i}`,
      pillar: q.pillar,
      text: q.text,
      listenFor: q.listenFor,
      followUps: q.followUps ?? [],
      source: { type: 'BASE' },
      priority: i < 2 ? 1 : 2,
    }),
  );

  // 5. Átvilágítás-típus specifikus kérdések – csak a címzett szerepkörnek.
  KIND_QUESTIONS[ctx.kind]
    .filter((q) => q.roles.includes(ctx.role))
    .forEach((q, i) =>
      out.push({
        id: `kind-${ctx.kind}-${ctx.role}-${i}`,
        pillar: q.pillar,
        text: q.text,
        listenFor: q.listenFor,
        followUps: q.followUps ?? [],
        source: { type: 'KIND', kind: ctx.kind },
        // A típus lényegét adó kérdések az első kettő – ezek kötelezők.
        priority: i < 2 ? 1 : 2,
      }),
    );

  // Duplikátumok kiszűrése, majd rendezés: prioritás → a típus pillérsúlya.
  const seen = new Set<string>();
  const unique = out.filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true)));
  const order = new Map(unique.map((q, i) => [q.id, i]));
  return unique.sort(
    (a, b) =>
      a.priority - b.priority ||
      profile.weights[b.pillar] - profile.weights[a.pillar] ||
      order.get(a.id)! - order.get(b.id)!,
  );
}

export function estimateMinutes(questions: InterviewQuestion[], maxPriority: 1 | 2 | 3 = 2): number {
  return questions.filter((q) => q.priority <= maxPriority).length * MINUTES_PER_QUESTION;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
