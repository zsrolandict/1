/**
 * SZTNH / Frascati risk scoring (0–100).
 *
 *   points_i  = weight_i × rating_i / 4
 *   base      = Σ points_i
 *   score     = clamp(base − Σ red-flag penalties, 0, 100)
 *               (general flags + the flags of the client's industry)
 *   knock-out = any criterion rated 0, or a critical red flag
 *               → score capped at KNOCKOUT_CAP (RED band)
 *
 *   GREEN ≥ 80 · YELLOW 50–79 · RED < 50
 */
import { FRASCATI_CRITERIA, KNOCKOUT_CAP, redFlagsFor, RISK_THRESHOLDS } from './constants';
import type { AuditAnswers, AuditResult, CriterionScore, Industry, RiskLevel } from './types';

const MAX_RATING = 4;

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.GREEN) return 'GREEN';
  if (score >= RISK_THRESHOLDS.YELLOW) return 'YELLOW';
  return 'RED';
}

export function scoreAudit(answers: AuditAnswers, industry: Industry): AuditResult {
  const criterionScores: CriterionScore[] = FRASCATI_CRITERIA.map((criterion) => {
    const rating = answers.ratings[criterion.id];
    return {
      id: criterion.id,
      rating,
      weight: criterion.weight,
      points: (criterion.weight * rating) / MAX_RATING,
    };
  });

  const baseScore = criterionScores.reduce((sum, c) => sum + c.points, 0);

  // Flags ticked under another industry are ignored if the industry changes.
  const raisedFlags = redFlagsFor(industry).filter((flag) => answers.redFlags[flag.id]);
  const penalty = raisedFlags.reduce((sum, flag) => sum + flag.penalty, 0);

  let score = Math.max(0, Math.min(100, baseScore - penalty));

  const knockOuts: string[] = [];
  for (const criterion of FRASCATI_CRITERIA) {
    if (answers.ratings[criterion.id] === 0) {
      knockOuts.push(
        `„${criterion.label}” kritérium nem teljesül – a Frascati-feltételek együttes teljesülése hiányzik.`,
      );
    }
  }
  for (const flag of raisedFlags) {
    if (flag.critical) {
      knockOuts.push(`Kritikus kockázat: ${flag.label}.`);
    }
  }
  if (knockOuts.length > 0) {
    score = Math.min(score, KNOCKOUT_CAP);
  }

  score = Math.round(score);

  // Remediation list: weakest criteria first, then raised flags.
  const recommendations = [
    ...FRASCATI_CRITERIA.filter((c) => answers.ratings[c.id] < 3)
      .sort((a, b) => answers.ratings[a.id] - answers.ratings[b.id])
      .map((c) => `${c.label}: ${c.remediation}`),
    ...raisedFlags.map((flag) => `${flag.label}: ${flag.remediation}`),
  ];

  return {
    criterionScores,
    baseScore: Math.round(baseScore),
    penalty,
    score,
    level: riskLevelForScore(score),
    knockOuts,
    recommendations,
  };
}
