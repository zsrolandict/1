import type { EngagementKind } from '@/lib/engagement/kinds';
import type { InterviewRecords } from '@/lib/interview/records';
import type { KnownFact } from '@/lib/interview/types';
import { normalize } from '@/lib/interview/transcript';
import { formatHufShort } from '@/lib/risk/engine';
import type { Pillar, Scale5 } from '@/lib/risk/types';
import { templateFor } from './apply';
import { CHECKLIST, formatAnswer, isVisible } from './checklist';
import { documentToIntake } from './documents/toIntake';
import { registryFindings } from './registry';
import type { IntakeState } from './state';
import type { IntakeSuggestion } from './types';

/**
 * Keresztellenőrzés (szabály alapú, AI nélkül):
 *  - ellentmondások a források között (kérdőív ↔ tábla ↔ dokumentum ↔ interjú),
 *  - egyedi kockázatok, amelyek csak több tábla együtt olvasásából derülnek ki.
 * Az interjú-elemzés AI-ellentmondásait is ide gyűjtjük, hogy egy helyen lássuk.
 */

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Conflict {
  key: string;
  severity: Severity;
  pillar: Pillar;
  topic: string;
  a: { source: string; statement: string };
  b: { source: string; statement: string };
  explanation: string;
  /** Szabály találta, vagy az interjú AI-elemzése. */
  origin: 'RULE' | 'AI_INTERVIEW';
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Cégnév összevetéshez: ékezet, írásjel és cégforma nélkül. */
export function partnerKey(name: string): string {
  return normalize(name)
    .replace(/\b(kft|zrt|nyrt|bt|kkt|rt|ev|e v|kft\.|ltd|gmbh)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function severityByGap(gap: number): Severity | null {
  if (gap >= 0.2) return 'HIGH';
  if (gap >= 0.1) return 'MEDIUM';
  return null;
}

export function crossChecks(
  state: IntakeState,
  kind: EngagementKind,
  records: InterviewRecords = {},
  facts: KnownFact[] = [],
): { conflicts: Conflict[]; suggestions: IntakeSuggestion[] } {
  const conflicts: Conflict[] = [];
  const suggestions: IntakeSuggestion[] = [];
  const a = state.answers;
  const t = state.tables;
  const q = (id: string) => CHECKLIST.find((x) => x.id === id)!;
  const answerText = (id: string) => `${id}: ${q(id).short} – ${formatAnswer(q(id), a[id])}`;

  // ── 1. Kérdőív számai ↔ táblák ─────────────────────────────────
  const numeric: { qid: string; table: keyof IntakeState['tables']; value: string; pillar: Pillar; topic: string }[] = [
    { qid: 'Q22', table: 'SALES_BY_CUSTOMER', value: 'top1', pillar: 'OPERATIONS', topic: 'Legnagyobb vevő aránya' },
    { qid: 'Q05', table: 'AR_AGING', value: 'share90', pillar: 'FINANCE', topic: '90 napon túl lejárt vevőállomány' },
    { qid: 'Q17', table: 'PURCHASES_BY_SUPPLIER', value: 'top1', pillar: 'OPERATIONS', topic: 'Legnagyobb beszállító aránya' },
  ];
  for (const n of numeric) {
    const ans = a[n.qid];
    const tv = t[n.table]?.values?.[n.value];
    if (typeof ans !== 'number' || tv == null) continue;
    const sev = severityByGap(Math.abs(ans / 100 - tv));
    if (!sev) continue;
    conflicts.push({
      key: `X:${n.qid}:${n.table}`,
      severity: sev,
      pillar: n.pillar,
      topic: n.topic,
      a: { source: 'Ügyfélkérdőív', statement: answerText(n.qid) },
      b: { source: `Adattábla (${t[n.table]!.fileName})`, statement: `számolt érték: ${pct(tv)}` },
      explanation: `A kérdőívben megadott ${ans}% és a táblából számolt ${pct(tv)} eltér. Érdemes rákérdezni, melyik a helyes, és miért tér el az ügyfél képe a számoktól.`,
      origin: 'RULE',
    });
  }

  // Transzferár: kérdőív ↔ kapcsolt ügyletek tábla
  const rp = t.RELATED_PARTY?.values;
  if (rp && a.Q01 === true && rp.missing > 0) {
    conflicts.push({
      key: 'X:Q01:RELATED_PARTY',
      severity: 'HIGH',
      pillar: 'FINANCE',
      topic: 'Transzferár-nyilvántartás',
      a: { source: 'Ügyfélkérdőív', statement: answerText('Q01') },
      b: { source: `Adattábla (${t.RELATED_PARTY!.fileName})`, statement: `${rp.missing} db 50 M Ft feletti ügylet nyilvántartás nélkül` },
      explanation: 'A kérdőív szerint minden nyilvántartás elkészült, a kapcsolt ügyletek listája szerint nem.',
      origin: 'RULE',
    });
  } else if (rp && typeof a.Q02 === 'number' && a.Q02 !== rp.missing && isVisible(q('Q02'), a)) {
    conflicts.push({
      key: 'X:Q02:RELATED_PARTY',
      severity: 'MEDIUM',
      pillar: 'FINANCE',
      topic: 'Hiányzó transzferár-nyilvántartások száma',
      a: { source: 'Ügyfélkérdőív', statement: answerText('Q02') },
      b: { source: `Adattábla (${t.RELATED_PARTY!.fileName})`, statement: `${rp.missing} db nyilvántartás nélküli ügylet` },
      explanation: 'A hiányzó nyilvántartások száma eltér; a kitettség a darabszámmal arányos.',
      origin: 'RULE',
    });
  }

  // ── 2. „A kérdőív szerint rendben” ↔ dokumentum / interjú / tábla találat ──
  const found: { code: string; source: string; statement: string; severity: Severity }[] = [];
  for (const d of state.documents) {
    for (const s of documentToIntake(d).suggestions) {
      if (s.code) found.push({ code: s.code, source: `Dokumentum (${d.fileName})`, statement: s.evidence, severity: 'HIGH' });
    }
  }
  for (const rec of Object.values(records)) {
    for (const f of rec?.analysis?.suggestedRedFlags ?? []) {
      if (f.templateCode) found.push({ code: f.templateCode, source: `Interjú (${rec!.alias || rec!.role})`, statement: `„${f.quote}”`, severity: 'MEDIUM' });
    }
  }
  for (const tbl of Object.values(t)) {
    for (const s of tbl?.result.suggestions ?? []) {
      if (s.code) found.push({ code: s.code, source: `Adattábla (${tbl!.fileName})`, statement: s.evidence, severity: 'MEDIUM' });
    }
  }
  const sectors = state.profile.sectors;
  for (const question of CHECKLIST) {
    if (!isVisible(question, a, sectors)) continue;
    const ans = a[question.id];
    if (ans === undefined || ans === '') continue;
    const codes = new Set(question.rules.map((r) => r.codeByKind?.[kind] ?? r.code).filter(Boolean) as string[]);
    const fired = question.rules.some((r) => {
      const c = r.when;
      if ('equals' in c) return ans === c.equals;
      if ('gte' in c) return typeof ans === 'number' && ans >= c.gte;
      if ('lt' in c) return typeof ans === 'number' && ans < c.lt;
      return typeof ans === 'string' && c.in.includes(ans);
    });
    if (fired) continue; // a kérdőív maga is jelez – nincs ellentmondás
    for (const code of codes) {
      for (const f of found.filter((x) => x.code === code)) {
        if (f.source.startsWith('Adattábla') && numeric.some((n) => n.qid === question.id)) continue; // már fent kezeltük
        const title = templateFor(code)?.title ?? code;
        conflicts.push({
          key: `X:${question.id}:${code}:${f.source}`,
          severity: f.severity,
          pillar: question.pillar,
          topic: title,
          a: { source: 'Ügyfélkérdőív', statement: answerText(question.id) },
          b: { source: f.source, statement: f.statement },
          explanation: `A kérdőív szerint ezen a területen nincs gond, a(z) ${f.source.toLowerCase()} viszont „${title}” kockázatra utal.`,
          origin: 'RULE',
        });
      }
    }
  }

  // ── 3. Interjúk AI-ellentmondásai egy helyen ────────────────────
  for (const rec of Object.values(records)) {
    rec?.analysis?.contradictions.forEach((c, i) => {
      conflicts.push({
        key: `I:${rec.role}:${i}`,
        severity: c.severity,
        pillar: c.pillar,
        topic: c.claim.slice(0, 80),
        a: { source: `Interjú (${rec.alias || rec.role})`, statement: `„${c.quote}”` },
        b: { source: c.conflictingSource || 'Ismert tény', statement: facts.find((f) => f.id === c.conflictingFactId)?.statement ?? c.conflictingFactId },
        explanation: c.explanation,
        origin: 'AI_INTERVIEW',
      });
    });
  }

  // ── 4. Egyedi kockázatok több tábla együtt olvasásából ──────────
  const custom = (key: string, pillar: Pillar, title: string, likelihood: Scale5, impact: Scale5, rationale: string, evidence: string, exposure?: number) =>
    suggestions.push({ key: `CC:${key}:${likelihood}${impact}`, origin: 'CROSS_CHECK', code: null, pillar, title, rationale, evidence, likelihood, impact, exposureHufEstimate: exposure ?? null });

  const sales = t.SALES_BY_CUSTOMER;
  const purchases = t.PURCHASES_BY_SUPPLIER;
  const related = t.RELATED_PARTY;
  const salesMap = new Map((sales?.partners ?? []).map((p) => [partnerKey(p.name), p]));
  const purchMap = new Map((purchases?.partners ?? []).map((p) => [partnerKey(p.name), p]));

  if (related) {
    const hits = related.partners.filter((p) => salesMap.has(partnerKey(p.name)) || purchMap.has(partnerKey(p.name)));
    if (hits.length) {
      custom(
        'RELATED_IN_TRADE', 'FINANCE', 'Kapcsolt fél a vevők vagy szállítók között',
        3, 3,
        'Kapcsolt vállalkozás a rendes vevő- vagy szállítói forgalomban is megjelenik: a piaci ár és a transzferár-nyilvántartás erre a forgalomra is vizsgálandó.',
        `Kapcsolt ügyletek × ${sales ? 'vevő' : ''}${sales && purchases ? '/' : ''}${purchases ? 'szállító' : ''} tábla: ${hits.map((h) => h.name).slice(0, 3).join(', ')}`,
      );
    }
  }
  if (sales && purchases) {
    const both = sales.partners
      .filter((p) => purchMap.has(partnerKey(p.name)))
      .filter((p) => p.amountHuf / Math.max(1, sales.totalHuf) >= 0.02);
    if (both.length) {
      custom(
        'BOTH_WAYS', 'FINANCE', 'Oda-vissza üzleti kapcsolat (vevő és szállító egyben)',
        2, 3,
        'Ugyanaz a partner jelentős vevő és szállító is: a nettósítás, a körbeszámlázás és a valós gazdasági tartalom vizsgálandó.',
        `Vevő- és szállítótábla: ${both.map((b) => b.name).slice(0, 3).join(', ')}`,
      );
    }
  }
  const ar = t.AR_AGING;
  if (ar?.values?.over180 && ar.totalHuf > 0 && ar.values.over180 / ar.totalHuf >= 0.02) {
    const who = ar.over180Top ? `, legnagyobb: ${ar.over180Top.name} (${formatHufShort(ar.over180Top.amountHuf)})` : '';
    custom(
      'OVER180', 'FINANCE', '180 napon túli követelés – értékvesztés vizsgálandó',
      3, 3,
      'A fél évnél régebben lejárt követelések behajthatósága kétséges; ha nincs rájuk értékvesztés, az eredmény és a mérleg túlértékelt lehet.',
      `Vevői korosítás (${ar.fileName}): 180 napon túl ${formatHufShort(ar.values.over180)}${who}`,
      Math.round(ar.values.over180),
    );
  }
  if (ar && sales && ar.values?.dso) {
    for (const p of ar.partners.slice(0, 5)) {
      const s = salesMap.get(partnerKey(p.name));
      if (!s || s.amountHuf <= 0) continue;
      const partnerDso = Math.round((p.amountHuf / s.amountHuf) * 365);
      if (p.amountHuf / ar.totalHuf >= 0.15 && partnerDso >= 2 * ar.values.dso && partnerDso >= 90) {
        custom(
          `SLOW:${partnerKey(p.name)}`, 'FINANCE', `Kulcsvevő elhúzódó fizetése (${p.name})`,
          3, 3,
          `A vevő a nyitott állomány ${pct(p.amountHuf / ar.totalHuf)}-át adja, fizetési ideje kb. ${partnerDso} nap, a cég átlagának (${ar.values.dso} nap) többszöröse.`,
          `Korosítás × vevőnkénti árbevétel: ${p.name} nyitott ${formatHufShort(p.amountHuf)}, éves forgalom ${formatHufShort(s.amountHuf)}`,
        );
      }
    }
  }

  // ── 5. Cégkivonat: eljárások, vezetőváltás, ellentmondás a kérdőívvel ──
  if (state.registry) {
    const reg = registryFindings(state.registry, state);
    conflicts.push(...reg.conflicts);
    suggestions.push(...reg.suggestions);
  }

  const order: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  conflicts.sort((x, y) => order[x.severity] - order[y.severity]);
  return { conflicts, suggestions };
}
