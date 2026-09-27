import { describe, expect, it } from 'vitest';
import { demoAssessment, emptyAssessment, emptyIpBox } from './defaults';
import { calculateCorporateTax, calculateSavings, calculateSzocho } from './engine';
import { scoreAudit } from './scoring';
import { calculateIpBox, nexusRatio, notificationDeadline } from './ipBox';
import { canonicalJson, createSeal, sha256Hex, verifySeal } from './seal';
import type { Assessment, AuditAnswers, RdCostInputs } from './types';

/** calculateSavings for a whole assessment. */
const savingsOf = (a: Assessment) => calculateSavings(a.client, a.costs, a.params, a.ip);
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
    const r = savingsOf(demoAssessment());

    // Direct cost: 96M + 18M + 4.8M + 22M + 35M + 14M
    expect(r.directRdCost).toBe(189_800_000);
    expect(r.citDeductibleBase).toBe(189_800_000);
    // University share 10M: 3 × 10M = 30M (≤ 50M) → +20M on top of the normal deduction
    expect(r.universityUplift).toBe(20_000_000);
    // Szocho: PhD 18M × 13% (cap 3 × 12 × 500k = 18M) + doctoral 4.8M × 6.5%; engineers on the Tao route
    expect(r.szocho.phdSaving).toBe(2_340_000);
    expect(r.szocho.doctoralSaving).toBe(312_000);
    expect(r.szocho.engineerSaving).toBe(0);
    expect(r.szocho.totalSaving).toBe(2_652_000);
    // Tao: (189.8M + 20M) × 9%
    expect(r.corporateTax.nominalSaving).toBe(18_882_000);
    // HIPA: material (22M) is already deducted as anyagköltség → 167.8M × 2%
    expect(r.hipaDeductibleBase).toBe(167_800_000);
    expect(r.hipaSaving).toBe(3_356_000);
    // Large company → innovation contribution 167.8M × 0.3%
    expect(r.innovationContributionSaving).toBe(503_400);
    // IP-box: (40M − 10M) × 50% × nexus(100 × 1.3 / 170) × 9%
    expect(r.ipBox.royaltyCitSaving).toBe(1_032_353);
    expect(r.totalAnnualSaving).toBe(26_425_753);
    // Net: − 9% × (2.652M + 3.356M + 0.5034M)
    expect(r.netAfterCitEffect).toBe(25_839_727);
    expect(r.multiYearPotential).toBe(79_277_259);
    expect(r.engineerRoutes.recommended).toBe('CIT');
  });

  it('removes engineer wages from the Tao base on the 16. § route', () => {
    const a = demoAssessment();
    a.params.engineerRelief = 'SZOCHO_16';
    const r = savingsOf(a);
    expect(r.citDeductibleBase).toBe(93_800_000);
    expect(r.szocho.engineerSaving).toBe(6_240_000);
    // HIPA base is unchanged
    expect(r.hipaSaving).toBe(3_356_000);
  });

  it('recommends the 16. § route for a loss-making client', () => {
    const a = demoAssessment();
    a.client.profitBeforeTax = -50_000_000;
    const r = savingsOf(a);
    expect(r.engineerRoutes.citImmediate).toBe(0);
    expect(r.engineerRoutes.recommended).toBe('SZOCHO_16');
  });

  it('exempts micro and small enterprises from the innovation contribution, not medium ones', () => {
    const a = demoAssessment();
    a.client.companySize = 'MICRO_SMALL';
    expect(savingsOf(a).innovationContributionSaving).toBe(0);
    a.client.companySize = 'MEDIUM';
    expect(savingsOf(a).innovationContributionSaving).toBe(503_400);
  });

  it('clamps the HIPA rate to the 2% statutory maximum and warns', () => {
    const a = emptyAssessment();
    a.client.annualRevenue = 1_000_000_000;
    a.costs.materialCosts = 10_000_000;
    a.params.hipaRate = 0.05;
    a.params.hipaMaterialAlreadyDeducted = false;
    const r = savingsOf(a);
    expect(r.hipaSaving).toBe(200_000);
    expect(r.warnings.some((w) => w.includes('2%'))).toBe(true);
  });

  it('ignores negative inputs', () => {
    const a = emptyAssessment();
    a.costs.materialCosts = -5_000_000;
    const r = savingsOf(a);
    expect(r.directRdCost).toBe(0);
    expect(r.totalAnnualSaving).toBe(0);
  });
});

describe('Tao / HIPA review rules', () => {
  const base = () => {
    const a = emptyAssessment();
    a.client.annualRevenue = 1_000_000_000;
    a.client.profitBeforeTax = 500_000_000;
    a.costs.engineerGrossWages = 50_000_000;
    a.costs.materialCosts = 10_000_000;
    a.costs.subcontractorCosts = 20_000_000;
    return a;
  };

  it('does not deduct material or subcontractor costs twice in the HIPA base', () => {
    const a = base();
    expect(savingsOf(a).hipaDeductibleBase).toBe(70_000_000); // material excluded by default
    a.params.hipaSubcontractorAlreadyDeducted = true;
    expect(savingsOf(a).hipaDeductibleBase).toBe(50_000_000);
    a.params.hipaMaterialAlreadyDeducted = false;
    expect(savingsOf(a).hipaDeductibleBase).toBe(60_000_000);
  });

  it('excludes grant-funded costs from Tao and HIPA', () => {
    const a = base();
    a.costs.grantFundedCosts = 30_000_000;
    const r = savingsOf(a);
    expect(r.citDeductibleBase).toBe(50_000_000);
    expect(r.hipaDeductibleBase).toBe(40_000_000);
  });

  it('caps the university 3× deduction at 50 M Ft', () => {
    const a = base();
    a.costs.universityJointCosts = 20_000_000; // 3 × 20M = 60M → capped at 50M → uplift 30M
    expect(savingsOf(a).universityUplift).toBe(30_000_000);
    a.costs.universityJointCosts = 60_000_000; // above the cap: 3× gives nothing extra
    expect(savingsOf(a).universityUplift).toBe(0);
  });
});

describe('IP-box', () => {
  const today = new Date('2026-09-27T10:00:00Z');
  const ip = (patch: Partial<ReturnType<typeof emptyIpBox>> = {}) => ({ ...emptyIpBox(), enabled: true, ...patch });
  const client = { profitBeforeTax: 1_000_000_000, annualRevenue: 2_000_000_000, companySize: 'LARGE' as const };

  it('computes the nexus ratio with the 1.3 uplift, capped at 1', () => {
    expect(nexusRatio({ nexusOwnCosts: 100, nexusRelatedPartyCosts: 30, nexusAcquisitionCosts: 70 })).toBeCloseTo(0.65);
    expect(nexusRatio({ nexusOwnCosts: 100, nexusRelatedPartyCosts: 10, nexusAcquisitionCosts: 0 })).toBe(1);
    expect(nexusRatio({ nexusOwnCosts: 0, nexusRelatedPartyCosts: 0, nexusAcquisitionCosts: 0 })).toBe(0);
  });

  it('gives a 4.5% effective Tao rate on royalty profit with full nexus', () => {
    const r = calculateIpBox(ip({ royaltyIncome: 100_000_000, nexusOwnCosts: 50_000_000 }), client, 0.02, today);
    expect(r.royaltyDeduction).toBe(50_000_000);
    expect(r.royaltyCitSaving).toBe(4_500_000);
    expect(r.effectiveRoyaltyCitRate).toBeCloseTo(0.045);
  });

  it('caps the royalty deduction at 50% of the pre-tax profit', () => {
    const r = calculateIpBox(
      ip({ royaltyIncome: 100_000_000, nexusOwnCosts: 1 }),
      { ...client, profitBeforeTax: 40_000_000 },
      0.02,
      today,
    );
    expect(r.royaltyDeduction).toBe(20_000_000);
  });

  it('tracks the 60-day notification deadline', () => {
    expect(notificationDeadline({ acquiredOn: '2026-09-01', reportedOn: '' }, today)).toEqual({
      status: 'OPEN',
      dueDate: '2026-10-31',
      daysLeft: 34,
    });
    expect(notificationDeadline({ acquiredOn: '2026-06-01', reportedOn: '' }, today).status).toBe('MISSED');
    expect(notificationDeadline({ acquiredOn: '2026-06-01', reportedOn: '2026-07-20' }, today).status).toBe('REPORTED_ON_TIME');
    expect(notificationDeadline({ acquiredOn: '2026-06-01', reportedOn: '2026-08-15' }, today).status).toBe('REPORTED_LATE');
    expect(notificationDeadline({ acquiredOn: '', reportedOn: '' }, today).status).toBe('NO_DATE');
  });

  it('allows the sale relief only after timely notification and a 1-year holding period', () => {
    const sale = { nexusOwnCosts: 1, plannedSaleGain: 10_000_000 };
    const ok = calculateIpBox(ip({ ...sale, acquiredOn: '2025-03-01', reportedOn: '2025-04-01', plannedSaleDate: '2026-06-01' }), client, 0.02, today);
    expect(ok.sale.eligible).toBe(true);
    expect(ok.sale.citSaving).toBe(900_000);

    const tooEarly = calculateIpBox(ip({ ...sale, acquiredOn: '2026-03-01', reportedOn: '2026-04-01', plannedSaleDate: '2026-12-01' }), client, 0.02, today);
    expect(tooEarly.sale.eligible).toBe(false);

    const late = calculateIpBox(ip({ ...sale, acquiredOn: '2025-03-01', reportedOn: '2025-06-01', plannedSaleDate: '2026-06-01' }), client, 0.02, today);
    expect(late.sale.eligible).toBe(false);
  });

  it('adds nothing to the HIPA until the share is set', () => {
    const r = calculateIpBox(ip({ royaltyIncome: 100_000_000, nexusOwnCosts: 1 }), client, 0.02, today);
    expect(r.hipaSaving).toBe(0);
    const r2 = calculateIpBox(ip({ royaltyIncome: 100_000_000, nexusOwnCosts: 1, hipaRoyaltyReliefShare: 0.5 }), client, 0.02, today);
    expect(r2.hipaSaving).toBe(1_000_000);
  });

  it('is excluded from totals when disabled', () => {
    const a = demoAssessment();
    a.ip.enabled = false;
    expect(savingsOf(a).totalAnnualSaving).toBe(26_425_753 - 1_032_353);
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

describe('seal compatibility', () => {
  it('still verifies a case sealed by engine 2026.2 (before the IP-box fields existed)', async () => {
    const current = demoAssessment();
    // Shape of a 2026.2 file: no ip, no grant / university / HIPA double-count fields.
    const { grantFundedCosts: _g, universityJointCosts: _u, ...oldCosts } = current.costs;
    const { hipaMaterialAlreadyDeducted: _m, hipaSubcontractorAlreadyDeducted: _s, ...oldParams } = current.params;
    const meta = { algorithm: 'SHA-256' as const, sealedAt: '2026-09-27T12:00:00.000Z', sealedBy: 'Régi', engineVersion: '2026.2' };
    const oldData = { client: current.client, costs: oldCosts, params: oldParams, audit: current.audit, sealHistory: [] };
    const hash = await sha256Hex(canonicalJson({ data: oldData, seal: meta }));
    const oldFile = { ...oldData, seal: { ...meta, hash } };

    const loaded = normaliseAssessment(JSON.parse(JSON.stringify(oldFile)));
    expect(loaded.costs.grantFundedCosts).toBe(0); // back-filled
    expect(await verifySeal(loaded)).toBe(true);
  });
});

describe('normaliseAssessment', () => {
  it('migrates v1.0 company sizes', () => {
    const legacy = { client: { companySize: 'SME' } };
    expect(normaliseAssessment(legacy).client.companySize).toBe('MICRO_SMALL');
    expect(normaliseAssessment({ client: { companySize: 'LIABLE' } }).client.companySize).toBe('LARGE');
  });
});
