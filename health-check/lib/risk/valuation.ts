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
      const count = bounded(formula.count, MAX_COUNT, true);
      const unit = bounded(formula.unitAmountHuf, MAX_UNIT_HUF, false);
      const param = formula.paramKey ? EXPERT_PARAMETERS[formula.paramKey] : undefined;
      const invalid = count == null || unit == null;
      if (invalid) return { valueHuf: 0, explanation: INVALID, unapprovedParameter: false };
      const capped = formula.count > MAX_COUNT || formula.unitAmountHuf > MAX_UNIT_HUF;
      return {
        valueHuf: Math.round(count * unit),
        explanation: `${count} db (${formula.label}) × ${short(unit)}${capped ? ' – a megadott érték a felső korlát fölött volt, ellenőrizd!' : ''}`,
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
    const ok = Number.isFinite(item.exposureHuf);
    return { valueHuf: money(item.exposureHuf), source: 'MANUAL', explanation: ok ? 'Kézi becslés' : INVALID, unapprovedParameter: false };
  }
  const computed = computeFormula(v.formula, c);
  if (v.overrideHuf != null) {
    return {
      valueHuf: money(v.overrideHuf),
      source: 'OVERRIDE',
      explanation: Number.isFinite(v.overrideHuf) ? `Szakértői felülírás (képlet szerint ≈ ${short(computed.valueHuf ?? 0)})` : INVALID,
      unapprovedParameter: false,
    };
  }
  return {
    valueHuf: money(computed.valueHuf ?? 0),
    source: 'FORMULA',
    explanation: Number.isFinite(computed.valueHuf ?? 0) ? computed.explanation : INVALID,
    unapprovedParameter: computed.unapprovedParameter,
  };
}

/** Darabszám-alapú képlet felső korlátai: ennél nagyobb érték elírás vagy manipulált bemenet. */
export const MAX_COUNT = 100_000;
export const MAX_UNIT_HUF = 10_000_000_000;

/**
 * Szám a [0, max] tartományban. Nem szám (szöveg, undefined), NaN, végtelen
 * vagy negatív érték: null – a hívó 0 Ft-tal és „érvénytelen” magyarázattal
 * számol, így semmi nem csorog tovább a kitettségbe és a várható veszteségbe.
 */
function bounded(x: unknown, max: number, integer: boolean): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return null;
  const v = Math.min(max, x);
  return integer ? Math.round(v) : v;
}

/** Pénzösszeg: nem véges (NaN, végtelen) vagy negatív érték helyett 0 – a magyarázat jelzi. */
function money(x: number): number {
  return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}
const INVALID = 'Érvénytelen összeg vagy paraméter – 0 Ft-tal számolva, javítsd!';

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
