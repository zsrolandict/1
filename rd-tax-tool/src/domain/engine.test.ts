import { describe, expect, it } from 'vitest';
import { demoAssessment, emptyAssessment, emptySoftware, newComponent } from './defaults';
import { DEMOS, findDemo } from './demos';
import { calculateCorporateTax, calculateSavings, calculateSzocho } from './engine';
import { scoreAudit } from './scoring';
import { calculateSoftware, nexusRatio, notificationDeadline } from './software';
import { canonicalJson, createSeal, sha256Hex, verifySeal } from './seal';
import type { Assessment, AuditAnswers, RdCostInputs, SoftwareAssetInputs } from './types';

/** calculateSavings for a whole assessment. */
const savingsOf = (a: Assessment) => calculateSavings(a.client, a.costs, a.params, a.software);
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
    // Software IP-box, tax year: (40M − 10M) × 50% × nexus(100 × 1.3 / 170) × 9%
    // (v2.0 was capitalised this year, so it is not yet in last year's cumulative nexus)
    expect(r.ipBox.royaltyCitSaving).toBe(1_032_353);
    // HIPA: royalty income deductible in full, no nexus → 40M × 2% and 40M × 0.3%
    expect(r.ipBox.hipaSaving).toBe(800_000);
    expect(r.ipBox.innovationContributionSaving).toBe(120_000);
    expect(r.totalAnnualSaving).toBe(27_345_753);
    // Net: − 9% × (2.652M + 3.356M + 0.5034M + 0.8M + 0.12M)
    expect(r.netAfterCitEffect).toBe(26_676_927);
    expect(r.multiYearPotential).toBe(82_037_259);
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

describe('software IP-box', () => {
  const today = new Date('2026-09-27T10:00:00Z');
  const client = { taxYear: 2025, profitBeforeTax: 1_000_000_000, annualRevenue: 2_000_000_000, companySize: 'LARGE' as const };
  const comp = (kind: 'ORIGINAL' | 'ENHANCEMENT', patch: Partial<ReturnType<typeof newComponent>> = {}) => ({
    ...newComponent(kind),
    ...patch,
  });
  const sw = (patch: Partial<SoftwareAssetInputs> = {}): SoftwareAssetInputs => ({
    ...emptySoftware(),
    enabled: true,
    components: [comp('ORIGINAL', { capitalizedOn: '2024-03-01', reportedOn: '2024-04-01', ownCosts: 100 })],
    royaltyYears: [{ year: 2025, royaltyIncome: 100_000_000, relatedCosts: 0, profitBeforeTax: 1_000_000_000 }],
    ...patch,
  });

  it('uses the 75-day notification window', () => {
    expect(notificationDeadline('2026-09-01', '', today)).toEqual({ status: 'OPEN', dueDate: '2026-11-15', daysLeft: 49 });
    expect(notificationDeadline('2026-06-01', '', today).status).toBe('MISSED');
    expect(notificationDeadline('2026-06-01', '2026-08-10', today).status).toBe('REPORTED_ON_TIME');
    expect(notificationDeadline('2026-06-01', '2026-08-20', today).status).toBe('REPORTED_LATE');
    expect(notificationDeadline('', '', today).status).toBe('NO_DATE');
  });

  it('computes a cumulative nexus with the 1.3 uplift, capped at 1', () => {
    expect(nexusRatio([{ ownCosts: 100, relatedPartyCosts: 30, acquisitionCosts: 70 }])).toBeCloseTo(0.65);
    expect(
      nexusRatio([
        { ownCosts: 100, relatedPartyCosts: 30, acquisitionCosts: 70 },
        { ownCosts: 100, relatedPartyCosts: 0, acquisitionCosts: 0 },
      ]),
    ).toBeCloseTo(0.8667); // 200 × 1.3 / 300
    expect(nexusRatio([{ ownCosts: 100, relatedPartyCosts: 10, acquisitionCosts: 0 }])).toBe(1);
  });

  it('keeps past own development in the nexus of later, passive years', () => {
    const r = calculateSoftware(
      sw({
        components: [comp('ORIGINAL', { capitalizedOn: '2022-01-10', reportedOn: '2022-02-01', ownCosts: 100 })],
        royaltyYears: [
          { year: 2022, royaltyIncome: 10_000_000, relatedCosts: 0, profitBeforeTax: 1e9 },
          { year: 2025, royaltyIncome: 10_000_000, relatedCosts: 0, profitBeforeTax: 1e9 },
        ],
      }),
      client,
      0.02,
      today,
    );
    expect(r.years.map((y) => y.nexusRatio)).toEqual([1, 1]);
  });

  it('gives a 4.5% effective Tao rate and full HIPA deduction on qualifying royalty', () => {
    const r = calculateSoftware(sw(), client, 0.02, today);
    expect(r.royaltyCitSaving).toBe(4_500_000);
    expect(r.effectiveRoyaltyCitRate).toBeCloseTo(0.045);
    expect(r.hipaSaving).toBe(2_000_000);
    expect(r.innovationContributionSaving).toBe(300_000);
  });

  it('applies no nexus in the HIPA', () => {
    const r = calculateSoftware(
      sw({ components: [comp('ORIGINAL', { capitalizedOn: '2024-03-01', ownCosts: 10, acquisitionCosts: 90 })] }),
      client,
      0.02,
      today,
    );
    expect(r.nexusRatio).toBeCloseTo(0.13);
    expect(r.hipaSaving).toBe(2_000_000);
  });

  it('gives no royalty relief on SaaS income without a separated licence fee', () => {
    const saas = calculateSoftware(sw({ revenueModel: 'SAAS' }), client, 0.02, today);
    expect(saas.royaltyQualifies).toBe(false);
    expect(saas.annualSaving).toBe(0);
    const licensed = calculateSoftware(sw({ revenueModel: 'SAAS', saasLicenceSeparated: true }), client, 0.02, today);
    expect(licensed.annualSaving).toBeGreaterThan(0);
  });

  it('caps the royalty deduction at 50% of the pre-tax profit', () => {
    const r = calculateSoftware(
      sw({ royaltyYears: [{ year: 2025, royaltyIncome: 100_000_000, relatedCosts: 0, profitBeforeTax: 40_000_000 }] }),
      client,
      0.02,
      today,
    );
    expect(r.royaltyDeduction).toBe(20_000_000);
  });

  describe('sale', () => {
    const sale = { saleDate: '2026-06-01', salePrice: 110_000_000, saleBookValue: 10_000_000, applyNexusToSaleGain: false };

    it('exempts the gain when the original was notified and held for a year', () => {
      const r = calculateSoftware(
        sw({ ...sale, components: [comp('ORIGINAL', { capitalizedOn: '2024-03-01', reportedOn: '2024-04-01', capitalizedValue: 100, ownCosts: 1 })] }),
        client,
        0.02,
        today,
      );
      expect(r.sale.gain).toBe(100_000_000);
      expect(r.sale.deduction).toBe(100_000_000);
      expect(r.sale.citSaving).toBe(9_000_000);
    });

    it('does not restart the holding period with an enhancement', () => {
      const r = calculateSoftware(
        sw({
          ...sale,
          components: [
            comp('ORIGINAL', { capitalizedOn: '2024-03-01', reportedOn: '2024-04-01', capitalizedValue: 100, ownCosts: 1 }),
            comp('ENHANCEMENT', { capitalizedOn: '2026-03-01', reportedOn: '2026-04-01', capitalizedValue: 100, ownCosts: 1 }),
          ],
        }),
        client,
        0.02,
        today,
      );
      expect(r.sale.exemptShare).toBe(1);
      expect(r.sale.eligible).toBe(true);
    });

    it('makes the un-notified enhancement share of the gain taxable', () => {
      const r = calculateSoftware(
        sw({
          ...sale,
          components: [
            comp('ORIGINAL', { capitalizedOn: '2024-03-01', reportedOn: '2024-04-01', capitalizedValue: 75, ownCosts: 1 }),
            comp('ENHANCEMENT', { capitalizedOn: '2025-03-01', reportedOn: '', capitalizedValue: 25, ownCosts: 1 }),
          ],
        }),
        client,
        0.02,
        today,
      );
      expect(r.sale.exemptShare).toBe(0.75);
      expect(r.sale.deduction).toBe(75_000_000);
      expect(r.sale.taxablePart).toBe(25_000_000);
    });

    it('blocks the relief when the original was not notified in time or the year is not up', () => {
      const late = calculateSoftware(
        sw({ ...sale, components: [comp('ORIGINAL', { capitalizedOn: '2024-03-01', reportedOn: '2024-07-01', ownCosts: 1 })] }),
        client,
        0.02,
        today,
      );
      expect(late.sale.eligible).toBe(false);
      const early = calculateSoftware(
        sw({ ...sale, components: [comp('ORIGINAL', { capitalizedOn: '2025-09-01', reportedOn: '2025-10-01', ownCosts: 1 })] }),
        client,
        0.02,
        today,
      );
      expect(early.sale.eligible).toBe(false);
    });
  });

  it('is excluded from totals when disabled', () => {
    const a = demoAssessment();
    a.software.enabled = false;
    expect(savingsOf(a).totalAnnualSaving).toBe(27_345_753 - 1_032_353 - 800_000 - 120_000);
  });
});

describe('capitalised development timing', () => {
  it('spreads the Tao deduction over the amortisation years', () => {
    const a = demoAssessment();
    a.params.citDeductionTiming = 'AMORTIZATION';
    a.params.amortizationYears = 3;
    const r = savingsOf(a);
    // (189.8M + 20M) / 3 this year
    expect(r.corporateTax.deductibleBase).toBe(69_933_333);
    expect(r.corporateTax.deferredToLaterYears).toBe(139_866_667);
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

describe('seal compatibility 2026.3', () => {
  it('verifies a 2026.3 seal (single-asset ip) after migration to the software model', async () => {
    const current = demoAssessment();
    const ip = { enabled: true, assetName: 'X', royaltyIncome: 1, royaltyRelatedCosts: 0, nexusOwnCosts: 1, nexusRelatedPartyCosts: 0, nexusAcquisitionCosts: 0, acquiredOn: '2026-01-01', reportedOn: '', plannedSaleGain: 0, plannedSaleDate: '', hipaRoyaltyReliefShare: 0, assetType: 'SOFTWARE' };
    const { software: _sw, seal: _s, sealHistory, sealedSource: _src, ...rest } = current;
    const oldData = { ...rest, ip, sealHistory };
    const meta = { algorithm: 'SHA-256' as const, sealedAt: '2026-09-27T12:00:00.000Z', sealedBy: 'Régi', engineVersion: '2026.3' };
    const hash = await sha256Hex(canonicalJson({ data: { client: oldData.client, costs: oldData.costs, params: oldData.params, audit: oldData.audit, ip, sealHistory }, seal: meta }));
    const loaded = normaliseAssessment(JSON.parse(JSON.stringify({ ...oldData, seal: { ...meta, hash } })));
    expect(loaded.software.enabled).toBe(true); // migrated
    expect(await verifySeal(loaded)).toBe(true);
    // A tampered legacy file still fails
    const tampered = JSON.parse(JSON.stringify({ ...oldData, seal: { ...meta, hash } }));
    tampered.ip.royaltyIncome = 999;
    expect(await verifySeal(normaliseAssessment(tampered))).toBe(false);
  });
});

describe('normaliseAssessment', () => {
  it('migrates v1.0 company sizes', () => {
    const legacy = { client: { companySize: 'SME' } };
    expect(normaliseAssessment(legacy).client.companySize).toBe('MICRO_SMALL');
    expect(normaliseAssessment({ client: { companySize: 'LIABLE' } }).client.companySize).toBe('LARGE');
  });
});

describe('demo library', () => {
  const levelForAudit = { FULL: 'GREEN', PARTIAL: 'YELLOW', NONE: 'RED' } as const;

  for (const demo of DEMOS) {
    it(`${demo.id} produces its advertised outcome (${demo.outcome})`, () => {
      const a = demo.build();
      const r = savingsOf(a);
      if (demo.group === 'software') {
        expect(r.ipBox.qualification.level).toBe(demo.outcome);
      } else {
        expect(scoreAudit(a.audit, a.client.industry).level).toBe(levelForAudit[demo.outcome]);
      }
      expect(Number.isFinite(r.totalAnnualSaving)).toBe(true);
    });
  }

  it('keeps the K+F relief when the software relief is not available', () => {
    const r = savingsOf(findDemo('software-none')!.build());
    expect(r.ipBox.annualSaving).toBe(0);
    expect(r.ipBox.sale.deduction).toBe(0);
    expect(r.corporateTax.nominalSaving).toBeGreaterThan(0);
  });

  it('makes only the notified share of the sale gain exempt in the partial demo', () => {
    const r = savingsOf(findDemo('software-partial')!.build());
    expect(r.ipBox.sale.exemptShare).toBeCloseTo(120 / 170);
    expect(r.ipBox.sale.taxablePart).toBeGreaterThan(0);
  });
});
