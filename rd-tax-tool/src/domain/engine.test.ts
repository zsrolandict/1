import { describe, expect, it } from 'vitest';
import { demoAssessment, emptyAssessment } from './defaults';
import { calculateCorporateTax, calculateSavings, calculateSzocho } from './engine';
import { scoreAudit } from './scoring';
import type { AuditAnswers } from './types';

describe('calculateSzocho', () => {
  it('waives 50% of 13% (6.5%) for engineers and 100% (13%) for PhDs', () => {
    const r = calculateSzocho({
      engineerGrossWages: 10_000_000,
      phdGrossWages: 10_000_000,
      materialCosts: 0,
      prototypeCosts: 0,
      subcontractorCosts: 0,
    });
    expect(r.engineerSaving).toBe(650_000);
    expect(r.phdSaving).toBe(1_300_000);
    expect(r.totalSaving).toBe(1_950_000);
    expect(r.fullContribution).toBe(2_600_000);
    expect(r.payableContribution).toBe(650_000);
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
    const { client, costs, params } = demoAssessment();
    const r = calculateSavings(client, costs, params);

    // Direct cost: 96M + 18M + 22M + 35M + 14M = 185M
    expect(r.directRdCost).toBe(185_000_000);
    // Szocho: 96M × 6.5% + 18M × 13% = 6.24M + 2.34M
    expect(r.szocho.totalSaving).toBe(8_580_000);
    // Tao: 185M × 9%
    expect(r.corporateTax.nominalSaving).toBe(16_650_000);
    // HIPA: 185M × 2%
    expect(r.hipaSaving).toBe(3_700_000);
    // Innovation contribution: 185M × 0.3% (liable company)
    expect(r.innovationContributionSaving).toBe(555_000);
    expect(r.totalAnnualSaving).toBe(29_485_000);
    // Current year + 2 self-revised years
    expect(r.multiYearPotential).toBe(88_455_000);
  });

  it('gives SMEs no innovation contribution saving', () => {
    const a = demoAssessment();
    a.client.companySize = 'SME';
    const r = calculateSavings(a.client, a.costs, a.params);
    expect(r.innovationContributionSaving).toBe(0);
  });

  it('adds the payable employer contribution to personnel cost when enabled', () => {
    const a = emptyAssessment();
    a.client.annualRevenue = 1_000_000_000;
    a.costs.engineerGrossWages = 10_000_000;
    a.params.includeEmployerContribution = true;
    const r = calculateSavings(a.client, a.costs, a.params);
    // 10M gross + (1.3M − 0.65M relief) payable szocho
    expect(r.personnelCost).toBe(10_650_000);
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

  it('scores a fully evidenced project 100 / GREEN', () => {
    const r = scoreAudit(
      answers({
        ratings: { NOVELTY: 4, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 4 },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.level).toBe('GREEN');
    expect(r.recommendations).toHaveLength(0);
  });

  it('scores all-2 ratings 50 / YELLOW', () => {
    const r = scoreAudit(answers());
    expect(r.score).toBe(50);
    expect(r.level).toBe('YELLOW');
  });

  it('applies red-flag penalties', () => {
    const r = scoreAudit(
      answers({
        ratings: { NOVELTY: 4, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 4 },
        redFlags: { ...emptyAssessment().audit.redFlags, NO_TIME_TRACKING: true },
      }),
    );
    expect(r.score).toBe(90);
    expect(r.penalty).toBe(10);
  });

  it('caps the score in RED when any criterion is zero (Frascati knock-out)', () => {
    const r = scoreAudit(
      answers({
        ratings: { NOVELTY: 0, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 4 },
      }),
    );
    expect(r.baseScore).toBe(75);
    expect(r.score).toBe(49);
    expect(r.level).toBe('RED');
    expect(r.knockOuts).toHaveLength(1);
  });

  it('caps the score in RED on production preparation', () => {
    const r = scoreAudit(
      answers({
        ratings: { NOVELTY: 4, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 4 },
        redFlags: { ...emptyAssessment().audit.redFlags, PRODUCTION_PREP: true },
      }),
    );
    expect(r.level).toBe('RED');
  });
});
