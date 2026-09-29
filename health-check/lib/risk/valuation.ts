import { EXPERT_PARAMETERS, type ExpertParameterKey } from './parameters';
import type { RiskItem } from './types';

/** Projekt-fejléc adatai – ezekből dolgoznak a forintosító képletek. */
export interface CompanyProfile {
  revenueHuf: number;
  /** Fedezeti hányad (0–1): az elmaradó árbevételből ennyi a valódi veszteség. */
  grossMarginPct: number;
  actualDsoDays: number;
  industryDsoDays: number;
}

/**
 * Az árbevétel „nincs megadva” állapota egy helyen: a 0 ezt jelenti (új,
 * saját projekt). Ilyenkor a forintosító képletek 0 Ft-ot adnak; a felület
 * és a riport ezt jelzi, nem mutat félrevezető összeget.
 */
export function hasRevenue(c: Pick<CompanyProfile, 'revenueHuf'>): boolean {
  return c.revenueHuf > 0;
}

export const DEFAULT_COMPANY: CompanyProfile = {
  revenueHuf: 2_400_000_000,
  grossMarginPct: 0.25,
  actualDsoDays: 72,
  industryDsoDays: 55,
};

/**
 * Képlettípusok. Mindegyik csak kiinduló becslést ad; a szakértő
 * tételenként felülírhatja (`Valuation.overrideHuf`).
 */
export type Formula =
  | {
      type: 'REVENUE_SHARE';
      /** Érintett árbevétel-arány (0–1), pl. top vevők aránya. */
      share: number;
      /** true: az elmaradó FEDEZET a veszteség (árbevétel × arány × fedezet). */
      marginBased: boolean;
      label: string;
    }
  | {
      type: 'PER_ITEM';
      count: number;
      unitAmountHuf: number;
      /** Ha a tételösszeg szakértői paraméterből jön – jóváhagyás-jelzéshez. */
      paramKey?: ExpertParameterKey;
      label: string;
    }
  | {
      /** Lekötött forgótőke: árbevétel / 365 × (tényleges DSO − iparági DSO). */
      type: 'DSO_GAP';
      label: string;
    }
  | { type: 'MANUAL' };

export interface Valuation {
  formula: Formula;
  /** A szakértő által beírt összeg; null = a képlet eredménye érvényes. */
  overrideHuf: number | null;
}

export interface FormulaResult {
  valueHuf: number | null;
  /** Ember által olvasható levezetés a felületre és a riportba. */
  explanation: string;
  /** Nem jóváhagyott szakértői paramétert használ. */
  unapprovedParameter: boolean;
}

const pct = (x: number) => `${(x * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%`;
const short = (v: number) => {
  const abs = Math.abs(v);
  const f = (n: number) => n.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${f(v / 1e9)} Mrd Ft`;
  if (abs >= 1e6) return `${f(v / 1e6)} M Ft`;
  return `${Math.round(v).toLocaleString('hu-HU')} Ft`;
};

export function computeFormula(formula: Formula, c: CompanyProfile): FormulaResult {
  switch (formula.type) {
    case 'REVENUE_SHARE': {
      const share = clamp01(formula.share);
      const margin = clamp01(c.grossMarginPct);
      const value = c.revenueHuf * share * (formula.marginBased ? margin : 1);
      const parts = [hasRevenue(c) ? `árbevétel ${short(c.revenueHuf)}` : 'árbevétel nincs megadva', `× ${pct(share)} (${formula.label})`];
      if (formula.marginBased) parts.push(`× fedezet ${pct(margin)}`);
      return { valueHuf: Math.round(value), explanation: parts.join(' '), unapprovedParameter: false };
    }
    case 'PER_ITEM': {
      const count = Math.max(0, Math.round(formula.count));
      const unit = Math.max(0, formula.unitAmountHuf);
      const param = formula.paramKey ? EXPERT_PARAMETERS[formula.paramKey] : undefined;
      return {
        valueHuf: count * unit,
        explanation: `${count} db (${formula.label}) × ${short(unit)}`,
        unapprovedParameter: Boolean(param && !param.approved && unit === param.valueHuf),
      };
    }
    case 'DSO_GAP': {
      const gap = Math.max(0, c.actualDsoDays - c.industryDsoDays);
      return {
        valueHuf: Math.round((c.revenueHuf / 365) * gap),
        explanation: `árbevétel ${short(c.revenueHuf)} / 365 × ${gap} nap DSO-többlet (${c.actualDsoDays} vs. iparági ${c.industryDsoDays})`,
        unapprovedParameter: false,
      };
    }
    default:
      return { valueHuf: null, explanation: 'Kézi becslés', unapprovedParameter: false };
  }
}

export interface ExposureResolution {
  valueHuf: number;
  source: 'FORMULA' | 'OVERRIDE' | 'MANUAL';
  explanation: string;
  unapprovedParameter: boolean;
}

/** A kockázat érvényes kitettsége: felülírás › képlet › kézi érték. */
export function resolveExposure(item: RiskItem, c: CompanyProfile): ExposureResolution {
  const v = item.valuation;
  if (!v || v.formula.type === 'MANUAL') {
    return { valueHuf: Math.max(0, item.exposureHuf || 0), source: 'MANUAL', explanation: 'Kézi becslés', unapprovedParameter: false };
  }
  const computed = computeFormula(v.formula, c);
  if (v.overrideHuf != null) {
    return {
      valueHuf: Math.max(0, v.overrideHuf),
      source: 'OVERRIDE',
      explanation: `Szakértői felülírás (képlet szerint ≈ ${short(computed.valueHuf ?? 0)})`,
      unapprovedParameter: false,
    };
  }
  return {
    valueHuf: computed.valueHuf ?? 0,
    source: 'FORMULA',
    explanation: computed.explanation,
    unapprovedParameter: computed.unapprovedParameter,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
