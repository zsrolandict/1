import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, hourSplit, PM_HOURS } from '@/lib/engagement/kinds';
import { KIND_RISKS } from '@/lib/engagement/kindRisks';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { assess } from '@/lib/risk/engine';
import { buildInterviewGuide } from './guide';
import { buildInterviewPlan, planMinutes } from './plan';
import { KIND_QUESTIONS } from './questionBank';
import { recordStatus, emptyRecord, isAnalysisStale } from './records';
import { notesToTranscript } from './transcript';

const none = DEFAULT_CATALOG.map((r) => ({ ...r, identified: false }));
const base = { risks: none, missingDocuments: [], facts: [] };

describe('buildInterviewPlan', () => {
  it('utódlásnál az alapító és a kijelölt utód kötelező, saját megnevezéssel és tippel', () => {
    const plan = buildInterviewPlan({ ...base, kind: 'SUCCESSION' });
    const [first, second] = plan;
    expect(first).toMatchObject({ role: 'OWNER_CEO', label: 'Alapító / átadó', priority: 'REQUIRED', order: 1 });
    expect(second).toMatchObject({ role: 'KEY_PERSON', label: 'Kijelölt utód / helyettes', priority: 'REQUIRED' });
    expect(second.tip).toContain('alapító jelenléte nélkül');
  });

  it('finanszírozásnál a pénzügyi vezetővel kezdünk', () => {
    expect(buildInterviewPlan({ ...base, kind: 'FINANCING_READINESS' })[0].role).toBe('CFO');
  });

  it('a bejelölt kockázat bevonja az illetékest, a piros kötelezővé teszi', () => {
    const risks = none.map((r) => (r.code === 'LEG-02' ? { ...r, identified: true } : r)); // 4×4 = piros
    const plan = buildInterviewPlan({ ...base, kind: 'FINANCING_READINESS', risks });
    const it = plan.find((p) => p.role === 'IT_LEAD');
    expect(it?.priority).toBe('REQUIRED');
    expect(it?.why.some((w) => w.includes('LEG-02'))).toBe(true);
  });

  it('a nem piros kockázat csak ajánlottként vonja be, és indoklást ad', () => {
    const risks = none.map((r) => (r.code === 'HR-03' ? { ...r, identified: true } : r)); // 3×2 = zöld
    const plan = buildInterviewPlan({ ...base, kind: 'FINANCING_READINESS', risks });
    expect(plan.find((p) => p.role === 'HR_LEAD')).toMatchObject({ priority: 'RECOMMENDED' });
  });

  it('minden interjúnak van időtartama, témája és a sorszámok folytonosak', () => {
    for (const k of ENGAGEMENT_KIND_LIST) {
      const plan = buildInterviewPlan({ ...base, kind: k.kind, risks: DEFAULT_CATALOG });
      plan.forEach((p, i) => {
        expect(p.order).toBe(i + 1);
        expect(p.minutes).toBeGreaterThanOrEqual(30);
        expect(p.minutes).toBeLessThanOrEqual(75);
        expect(p.topics.length).toBeGreaterThan(0);
      });
      const m = planMinutes(plan);
      expect(m.all).toBeGreaterThanOrEqual(m.required);
    }
  });
});

describe('típusfüggő kérdések címzettje', () => {
  it('az utódnak más kérdés szól, mint az alapítónak', () => {
    const q = (role: 'OWNER_CEO' | 'KEY_PERSON') =>
      buildInterviewGuide({ ...base, kind: 'SUCCESSION', role })
        .filter((x) => x.source.type === 'KIND')
        .map((x) => x.text);
    const owner = q('OWNER_CEO');
    const successor = q('KEY_PERSON');
    expect(owner.some((t) => t.includes('kijelölt utód'))).toBe(true);
    expect(successor.some((t) => t.includes('Ön szerint mikor és hogyan veszi át'))).toBe(true);
    expect(owner.filter((t) => successor.includes(t))).toHaveLength(0);
  });

  it('minden típusnak van legalább 5 kérdése, legalább 3 különböző címzettnek', () => {
    for (const k of ENGAGEMENT_KIND_LIST) {
      const qs = KIND_QUESTIONS[k.kind];
      expect(qs.length).toBeGreaterThanOrEqual(5);
      expect(new Set(qs.flatMap((q) => q.roles)).size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('típus hatása a mátrixra', () => {
  it('a Health Score a típus pillérsúlyaival számol', () => {
    const plain = assess(DEFAULT_CATALOG);
    const fin = assess(DEFAULT_CATALOG, { pillarWeights: ENGAGEMENT_KINDS.FINANCING_READINESS.weights });
    const succ = assess(DEFAULT_CATALOG, { pillarWeights: ENGAGEMENT_KINDS.SUCCESSION.weights });
    const p = plain.pillars;
    const expectedFin = Math.round(p.FINANCE.healthScore! * 0.5 + p.LEGAL.healthScore! * 0.2 + p.OPERATIONS.healthScore! * 0.2 + p.HR.healthScore! * 0.1);
    expect(fin.totals.healthScore).toBe(expectedFin);
    expect(succ.totals.healthScore).not.toBe(fin.totals.healthScore);
  });

  it('az óraszámkeret bontása kiadja a keretet', () => {
    for (const k of ENGAGEMENT_KIND_LIST) {
      const total = hourSplit(k.kind).reduce((a, h) => a + h.hours, 0) + PM_HOURS;
      expect(total).toBe(k.hourBudget);
    }
  });

  it('minden típusnak 2 saját tétele van, egyedi kóddal és indoklással', () => {
    const codes = new Set(DEFAULT_CATALOG.map((r) => r.code));
    for (const k of ENGAGEMENT_KIND_LIST) {
      expect(KIND_RISKS[k.kind]).toHaveLength(2);
      for (const r of KIND_RISKS[k.kind]) {
        expect(codes.has(r.code)).toBe(false);
        codes.add(r.code);
        expect((r.reasoning ?? '').length).toBeGreaterThan(50);
      }
    }
  });
});

describe('interjú-rekord állapota', () => {
  it('tervezett → folyamatban → leirat → elemezve', () => {
    const r = emptyRecord('CFO');
    expect(recordStatus(undefined)).toBe('PLANNED');
    expect(recordStatus(r)).toBe('PLANNED');
    expect(recordStatus({ ...r, asked: ['q1'] })).toBe('IN_PROGRESS');
    const t = notesToTranscript('Kérdező: szia');
    expect(recordStatus({ ...r, transcript: t })).toBe('TRANSCRIBED');
    expect(
      recordStatus({
        ...r,
        transcript: t,
        analysis: { summary: '', statements: [], suggestedRedFlags: [], contradictions: [], followUpQuestions: [], discardedUnverified: 0 },
      }),
    ).toBe('ANALYZED');
  });
});

describe('elemzés céltól függő érvényessége', () => {
  const analysis = { summary: '', statements: [], suggestedRedFlags: [], contradictions: [], followUpQuestions: [], discardedUnverified: 0 };
  it('más célra készült élő elemzés: újra kell futtatni', () => {
    const r = { ...emptyRecord('OWNER_CEO'), analysis, analysisKind: 'VENDOR_DD' as const };
    expect(isAnalysisStale(r, 'VENDOR_DD')).toBe(false);
    expect(isAnalysisStale(r, 'POST_MERGER')).toBe(true);
  });
  it('minta-elemzést és ismeretlen célú régi mentést nem jelöl', () => {
    expect(isAnalysisStale({ ...emptyRecord('CFO'), analysis, analysisIsSample: true, analysisKind: null }, 'POST_MERGER')).toBe(false);
    expect(isAnalysisStale({ ...emptyRecord('CFO'), analysis }, 'POST_MERGER')).toBe(false);
    expect(isAnalysisStale(undefined, 'POST_MERGER')).toBe(false);
  });
});
