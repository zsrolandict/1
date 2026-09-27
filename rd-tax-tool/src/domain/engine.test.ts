import { describe, expect, it } from 'vitest';
import { demoAssessment, emptyAssessment } from './defaults';
import { calculateCorporateTax, calculateSavings, calculateSzocho } from './engine';
import { scoreAudit } from './scoring';
import { canonicalJson, createSeal, verifySeal } from './seal';
import type { AuditAnswers, RdCostInputs } from './types';
import { normaliseAssessment } from '../state/useAssessment';

const costs = (patch: Partial<RdCostInputs>): RdCostInputs => ({ ...emptyAssessment().costs, ...patch });

describe('calculateSzocho', () => {
  it('gives PhDs 100% relief up to 500 000 Ft / person / month', () => {
    // 2 PhDs × 12 months × 500k = 12M cap; 15M wages → 3M over the cap
    const r = calculateSzocho(costs({ phdGrossWages: 15_000_000, phdHeadcount: 2 }), { engineerRelief: 'CIT' });
    expect(r.phdSaving).toBe(1_560_000); // 12M × 13%
    expect(r.phdWagesOverCap).toBe(3_000_000);
  });

  it('gives doctoral students 50% relief up to 200 000 Ft / person / month', () => {
    const r = calculateSzocho(costs({ doctoralGrossWages: 3_000_000, doctoralHeadcount: 1 }), { engineerRelief: 'CIT' });
    // cap: 1 × 12 × 200k = 2.4M → 2.4M × 6.5%
    expect(r.doctoralSaving).toBe(156_000);
    expect(r.doctoralWagesOverCap).toBe(600_000);
  });

  it('prorates the caps by employment months', () => {
    const r = calculateSzocho(costs({ phdGrossWages: 6_000_000, phdHeadcount: 1, researcherMonths: 6 }), {
      engineerRelief: 'CIT',
    });
    expect(r.phdSaving).toBe(390_000); // 6 × 500k = 3M × 13%
  });

  it('gives no PhD relief without a headcount', () => {
    const r = calculateSzocho(costs({ phdGrossWages: 6_000_000 }), { engineerRelief: 'CIT' });
    expect(r.phdSaving).toBe(0);
  });

  it('gives engineers szocho relief only on the 16. § route', () => {
    const c = costs({ engineerGrossWages: 10_000_000 });
    expect(calculateSzocho(c, { engineerRelief: 'CIT' }).engineerSaving).toBe(0);
    expect(calculateSzocho(c, { engineerRelief: 'SZOCHO_16' }).engineerSaving).toBe(650_000);
  });
});

describe('calculateCorporateTax', () => {
  it('splits the 9% saving into immediate and deferred parts by pre-tax profit', () => {
    const r = calculateCorporateTax(100_000_000, 40_000_000);
    expect(r.nominalSaving).toBe(9_000_000);
    expect(r.immediateSaving).toBe(3_600_000);
    expect(r.deferredSaving).toBe(5_400_000);
  });

  it('treats a loss-making year as fully deferred', () => {
    const r = calculateCorporateTax(50_000_000, -10_000_000);
    expect(r.immediateSaving).toBe(0);
    expect(r.deferredSaving).toBe(4_500_000);
  });
});

describe('calculateSavings', () => {
  it('reproduces the hand-checked demo case', () => {
    const { client, costs: c, params } = demoAssessment();
    const r = calculateSavings(client, c, params);

    // Direct cost: 96M + 18M + 4.8M + 22M + 35M + 14M
    expect(r.directRdCost).toBe(189_800_000);
    expect(r.citDeductibleBase).toBe(189_800_000);
    // Szocho: PhD 18M × 13% (cap 3 × 12 × 500k = 18M) + doctoral 4.8M × 6.5% (cap 4.8M); engineers on the Tao route
    expect(r.szocho.phdSaving).toBe(2_340_000);
    expect(r.szocho.doctoralSaving).toBe(312_000);
    expect(r.szocho.engineerSaving).toBe(0);
    expect(r.szocho.totalSaving).toBe(2_652_000);
    expect(r.corporateTax.nominalSaving).toBe(17_082_000);
    expect(r.hipaSaving).toBe(3_796_000);
    // Large company → liable for the innovation contribution
    expect(r.innovationContributionSaving).toBe(569_400);
    expect(r.totalAnnualSaving).toBe(24_099_400);
    expect(r.multiYearPotential).toBe(72_298_200);
    expect(r.engineerRoutes.recommended).toBe('CIT');
  });

  it('removes engineer wages from the Tao base on the 16. § route', () => {
    const a = demoAssessment();
    a.params.engineerRelief = 'SZOCHO_16';
    const r = calculateSavings(a.client, a.costs, a.params);
    expect(r.citDeductibleBase).toBe(93_800_000);
    expect(r.szocho.engineerSaving).toBe(6_240_000);
    // HIPA base is unchanged
    expect(r.hipaSaving).toBe(3_796_000);
  });

  it('recommends the 16. § route for a loss-making client', () => {
    const a = demoAssessment();
    a.client.profitBeforeTax = -50_000_000;
    const r = calculateSavings(a.client, a.costs, a.params);
    expect(r.engineerRoutes.citImmediate).toBe(0);
    expect(r.engineerRoutes.recommended).toBe('SZOCHO_16');
  });

  it('exempts micro and small enterprises from the innovation contribution, not medium ones', () => {
    const a = demoAssessment();
    a.client.companySize = 'MICRO_SMALL';
    expect(calculateSavings(a.client, a.costs, a.params).innovationContributionSaving).toBe(0);
    a.client.companySize = 'MEDIUM';
    expect(calculateSavings(a.client, a.costs, a.params).innovationContributionSaving).toBe(569_400);
  });

  it('clamps the HIPA rate to the 2% statutory maximum and warns', () => {
    const a = emptyAssessment();
    a.client.annualRevenue = 1_000_000_000;
    a.costs.materialCosts = 10_000_000;
    a.params.hipaRate = 0.05;
    const r = calculateSavings(a.client, a.costs, a.params);
    expect(r.hipaSaving).toBe(200_000);
    expect(r.warnings.some((w) => w.includes('2%'))).toBe(true);
  });

  it('ignores negative inputs', () => {
    const a = emptyAssessment();
    a.costs.materialCosts = -5_000_000;
    const r = calculateSavings(a.client, a.costs, a.params);
    expect(r.directRdCost).toBe(0);
    expect(r.totalAnnualSaving).toBe(0);
  });
});

describe('scoreAudit', () => {
  const answers = (overrides: Partial<AuditAnswers> = {}): AuditAnswers => ({
    ...emptyAssessment().audit,
    ...overrides,
  });
  const allFour = { NOVELTY: 4, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 4 } as const;

  it('scores a fully evidenced project 100 / GREEN', () => {
    const r = scoreAudit(answers({ ratings: allFour }), 'OTHER');
    expect(r.score).toBe(100);
    expect(r.level).toBe('GREEN');
    expect(r.recommendations).toHaveLength(0);
  });

  it('scores all-2 ratings 50 / YELLOW', () => {
    const r = scoreAudit(answers(), 'OTHER');
    expect(r.score).toBe(50);
    expect(r.level).toBe('YELLOW');
  });

  it('applies red-flag penalties', () => {
    const r = scoreAudit(answers({ ratings: allFour, redFlags: { NO_TIME_TRACKING: true } }), 'OTHER');
    expect(r.score).toBe(90);
    expect(r.penalty).toBe(10);
  });

  it('scores industry flags only for the matching industry', () => {
    const a = answers({ ratings: allFour, redFlags: { SOFTWARE_MAINTENANCE: true } });
    expect(scoreAudit(a, 'SOFTWARE_DIGITAL').penalty).toBe(15);
    expect(scoreAudit(a, 'FOOD').penalty).toBe(0);
  });

  it('caps the score in RED when any criterion is zero (Frascati knock-out)', () => {
    const r = scoreAudit(answers({ ratings: { ...allFour, NOVELTY: 0 } }), 'OTHER');
    expect(r.baseScore).toBe(75);
    expect(r.score).toBe(49);
    expect(r.level).toBe('RED');
    expect(r.knockOuts).toHaveLength(1);
  });

  it('caps the score in RED on production preparation', () => {
    const r = scoreAudit(answers({ ratings: allFour, redFlags: { PRODUCTION_PREP: true } }), 'OTHER');
    expect(r.level).toBe('RED');
  });
});

describe('seal', () => {
  it('produces key-order independent canonical JSON at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[2,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('verifies an untouched sealed case', async () => {
    const a = demoAssessment();
    a.seal = await createSeal(a, 'Teszt Tanácsadó', new Date('2026-09-27T11:30:00Z'));
    expect(a.seal.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifySeal(a)).toBe(true);
  });

  it('detects a change to nested data after sealing', async () => {
    const a = demoAssessment();
    a.seal = await createSeal(a, 'Teszt Tanácsadó');
    a.costs.prototypeCosts += 1;
    expect(await verifySeal(a)).toBe(false);
  });

  it('detects a changed seal timestamp', async () => {
    const a = demoAssessment();
    a.seal = await createSeal(a, 'Teszt Tanácsadó');
    a.seal = { ...a.seal, sealedAt: '2020-01-01T00:00:00.000Z' };
    expect(await verifySeal(a)).toBe(false);
  });

  it('survives a JSON save / load round trip', async () => {
    const a = demoAssessment();
    a.seal = await createSeal(a, 'Teszt Tanácsadó');
    const reloaded = normaliseAssessment(JSON.parse(JSON.stringify(a)));
    expect(await verifySeal(reloaded)).toBe(true);
  });
});

describe('normaliseAssessment', () => {
  it('migrates v1.0 company sizes', () => {
    const legacy = { client: { companySize: 'SME' } };
    expect(normaliseAssessment(legacy).client.companySize).toBe('MICRO_SMALL');
    expect(normaliseAssessment({ client: { companySize: 'LIABLE' } }).client.companySize).toBe('LARGE');
  });
});
