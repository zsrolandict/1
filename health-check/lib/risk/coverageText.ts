import { PILLAR_LABEL } from './catalog';
import { COVERAGE_GATE, COVERAGE_PILLAR_MIN } from './coverageRules';
import type { Pillar, PillarState, PillarSummary, RiskAssessment } from './types';

/**
 * A lefedettség és a minősítési kapu szövegei – egy helyen, hogy a felület,
 * az Excel és a PDF ugyanazt, semleges tanácsadói hangon mondja.
 */

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const PILLAR_STATE_LABEL: Record<PillarState, string> = {
  EXAMINED: 'Vizsgált',
  PARTIAL: 'Részben vizsgált',
  NOT_EXAMINED: 'Nem vizsgált',
};

export function notExaminedPillars(a: Pick<RiskAssessment, 'pillars'>): Pillar[] {
  return (Object.values(a.pillars) as PillarSummary[]).filter((p) => p.state === 'NOT_EXAMINED').map((p) => p.pillar);
}

/** „Health Score” kijelzése: szám, vagy „Nem értékelhető”. */
export function healthText(score: number | null): string {
  return score == null ? 'Nem értékelhető' : String(score);
}

/**
 * A fejléc / fedőlap sávjának szövege, vagy null, ha a felmérés teljes értékű.
 * Semleges megfogalmazás: mit nem lehetett vizsgálni, és mi következik belőle.
 */
export function coverageNotice(a: Pick<RiskAssessment, 'pillars' | 'totals'>): { title: string; text: string } | null {
  const t = a.totals;
  if (t.coverage == null) return null;
  const missing = notExaminedPillars(a).map((p) => PILLAR_LABEL[p]);
  const partial = (Object.values(a.pillars) as PillarSummary[]).filter((p) => p.state === 'PARTIAL').map((p) => PILLAR_LABEL[p.pillar]);
  const scope = [
    missing.length ? `Nem vizsgált terület: ${missing.join(', ')}.` : '',
    partial.length ? `Részben vizsgált terület (a megállapítások beszámítanak): ${partial.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (t.healthScore == null) {
    return {
      title: 'Nem értékelhető felmérés',
      text: `A rendelkezésre álló adatok alapján egyik terület sem vizsgálható érdemben (lefedettség: ${pct(t.coverage)}). Pontszám és minősítés nem adható.`,
    };
  }
  if (!t.qualified) {
    return {
      title: 'Részleges / nem minősített felmérés',
      text:
        `A vizsgálati lefedettség ${pct(t.coverage)}; a teljes értékű minősítéshez legalább ${pct(COVERAGE_GATE)} szükséges. ` +
        `A Health Score csak a vizsgált területeket tükrözi, ezért „Zöld” minősítés nem adható. ${scope}`.trim(),
    };
  }
  return scope ? { title: 'Teljes értékű felmérés, korlátozott terjedelemmel', text: `Lefedettség: ${pct(t.coverage)}. ${scope}` } : null;
}

export const COVERAGE_METHOD_TEXT =
  `A Health Score csak a vizsgált területeket tükrözi (dinamikus nevező): a ${pct(COVERAGE_PILLAR_MIN)} lefedettség alatti, ` +
  `megállapítás nélküli pillér kimarad a számításból, és nem kap pontot. A lefedettség pillérenként a megválaszolt kérdőív-kérdések és a ` +
  `beérkezett kötelező iratok arányának átlaga (szakértői felülbírálással, indoklással). ${pct(COVERAGE_GATE)} összesített lefedettség ` +
  `alatt a felmérés részleges, és nem kaphat „Zöld” minősítést.`;
