import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from './catalog';
import { assess } from './engine';
import { applySuggestion, hydrateItem } from './store';
import { computeFormula, DEFAULT_COMPANY, resolveExposure, type CompanyProfile } from './valuation';

const company: CompanyProfile = { revenueHuf: 2_400_000_000, grossMarginPct: 0.25, actualDsoDays: 72, industryDsoDays: 55 };
const leg01 = DEFAULT_CATALOG.find((r) => r.code === 'LEG-01')!;

describe('computeFormula', () => {
  it('árbevétel-arány: a teljes érintett árbevétel (912 M Ft) vagy az elmaradó fedezet', () => {
    const full = computeFormula({ type: 'REVENUE_SHARE', share: 0.38, marginBased: false, label: 'x' }, company);
    const margin = computeFormula({ type: 'REVENUE_SHARE', share: 0.38, marginBased: true, label: 'x' }, company);
    expect(full.valueHuf).toBe(912_000_000);
    expect(margin.valueHuf).toBe(228_000_000);
    expect(margin.explanation).toContain('fedezet 25%');
  });

  it('darabszám × tételösszeg, nem jóváhagyott paraméter jelzése', () => {
    const r = computeFormula({ type: 'PER_ITEM', count: 4, unitAmountHuf: 2_000_000, paramKey: 'TP_EXPOSURE_PER_RECORD', label: 'nyilvántartás' }, company);
    expect(r.valueHuf).toBe(8_000_000);
    expect(r.unapprovedParameter).toBe(true);
    const custom = computeFormula({ type: 'PER_ITEM', count: 4, unitAmountHuf: 1_500_000, paramKey: 'TP_EXPOSURE_PER_RECORD', label: 'x' }, company);
    expect(custom.unapprovedParameter).toBe(false); // a szakértő saját összeget adott meg
  });

  it('DSO-különbség: lekötött forgótőke, negatív különbség nem ad pénzt', () => {
    expect(computeFormula({ type: 'DSO_GAP', label: 'x' }, company).valueHuf).toBe(Math.round((2_400_000_000 / 365) * 17));
    expect(computeFormula({ type: 'DSO_GAP', label: 'x' }, { ...company, actualDsoDays: 40 }).valueHuf).toBe(0);
  });

  it('hibás bemenetet korlátoz (arány 0–1)', () => {
    expect(computeFormula({ type: 'REVENUE_SHARE', share: 3, marginBased: false, label: 'x' }, company).valueHuf).toBe(2_400_000_000);
  });
});

describe('resolveExposure', () => {
  it('felülírás › képlet › kézi', () => {
    expect(resolveExposure(leg01, company)).toMatchObject({ source: 'FORMULA', valueHuf: 228_000_000 });
    const over = { ...leg01, valuation: { ...leg01.valuation!, overrideHuf: 150_000_000 } };
    expect(resolveExposure(over, company)).toMatchObject({ source: 'OVERRIDE', valueHuf: 150_000_000 });
    const manual = DEFAULT_CATALOG.find((r) => r.code === 'LEG-02')!;
    expect(resolveExposure(manual, company)).toMatchObject({ source: 'MANUAL', valueHuf: 30_000_000 });
  });

  it('a motor a cégadatokkal számol, és visszaadja a levezetést', () => {
    const res = assess(DEFAULT_CATALOG, { company });
    const r = res.risks.find((x) => x.code === 'LEG-01')!;
    expect(r.exposureHuf).toBe(228_000_000);
    expect(r.exposureSource).toBe('FORMULA');
    const doubled = assess(DEFAULT_CATALOG, { company: { ...company, revenueHuf: 4_800_000_000 } });
    expect(doubled.risks.find((x) => x.code === 'LEG-01')!.exposureHuf).toBe(456_000_000);
  });
});

describe('régi mentések (hydrateItem)', () => {
  it('hiányzó indoklást és képletet pótol', () => {
    const { reasoning, valuation, ...old } = leg01;
    const h = hydrateItem(old);
    expect(h.reasoning).toBe(reasoning);
    expect(h.valuation?.overrideHuf).toBeNull();
  });

  it('a korábban kézzel átírt összeg felülírásként megmarad', () => {
    const { reasoning, valuation, ...old } = leg01;
    const h = hydrateItem({ ...old, exposureHuf: 77_000_000 });
    expect(resolveExposure(h, DEFAULT_COMPANY).valueHuf).toBe(77_000_000);
  });
});

describe('applySuggestion kitettség', () => {
  const s = {
    templateCode: 'LEG-01',
    pillar: 'LEGAL' as const,
    title: 't',
    rationale: 'r',
    quote: 'q',
    startMs: null,
    likelihood: 3 as const,
    impact: 5 as const,
    exposureHufEstimate: 0,
    confidence: 0.9,
  };
  it('kisebb interjús becslés nem csökkenti a képlet szerinti kitettséget', () => {
    const items = applySuggestion(DEFAULT_CATALOG, { ...s, exposureHufEstimate: 10_000_000 }, 'e', company);
    expect(
      resolveExposure(
        items.find((r) => r.code === 'LEG-01')!,
        company,
      ).valueHuf,
    ).toBe(228_000_000);
  });
  it('nagyobb becslés felülírásként érvényesül', () => {
    const items = applySuggestion(DEFAULT_CATALOG, { ...s, exposureHufEstimate: 500_000_000 }, 'e', company);
    expect(
      resolveExposure(
        items.find((r) => r.code === 'LEG-01')!,
        company,
      ),
    ).toMatchObject({ source: 'OVERRIDE', valueHuf: 500_000_000 });
  });
});
