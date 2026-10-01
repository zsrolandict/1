import { parseNumber } from '../tables/parse';
import type { ExtractedFact, ExtractedValue, FinUnit } from '../documents/types';
import { FACT_SPEC, type AuditOpinion, type FactKey, type FinFacts, type FinField } from './model';

/**
 * Az AI által kiolvasott szöveges értékek átalakítása: a beszámoló „ezer Ft”
 * egységét forintra váltjuk, a zárójeles számot negatívnak vesszük, a tényeket
 * a mező típusa szerint értelmezzük. Amit nem lehet értelmezni, az kimarad.
 */

export const UNIT_FACTOR: Record<FinUnit, number> = { HUF: 1, THOUSAND_HUF: 1000, MILLION_HUF: 1_000_000 };
export const UNIT_LABEL: Record<FinUnit, string> = { HUF: 'Ft', THOUSAND_HUF: 'ezer Ft', MILLION_HUF: 'millió Ft' };

export function statedToHuf(stated: string, unit: FinUnit): number | null {
  const n = parseNumber(stated.replace(/[–−]/g, '-').trim());
  return n == null ? null : Math.round(n * UNIT_FACTOR[unit]);
}

export function rawValues(raw: { field: FinField; year: number; stated: string; quote: string }[], unit: FinUnit): ExtractedValue[] {
  return raw.flatMap((v) => {
    const valueHuf = statedToHuf(v.stated, unit);
    if (valueHuf == null || !Number.isInteger(v.year) || v.year < 1990 || v.year > 2100) return [];
    return [{ field: v.field, year: v.year, valueHuf, stated: v.stated, quote: v.quote, pageIndex: null }];
  });
}

const OPINION_WORDS: [RegExp, AuditOpinion][] = [
  [/visszautas|disclaimer/i, 'DISCLAIMER'],
  [/ellenvélemény|adverse/i, 'ADVERSE'],
  [/minősített|korlátoz|qualified/i, 'QUALIFIED'],
  [/minősítés nélküli|tiszta|unqualified|unmodified/i, 'UNQUALIFIED'],
  [/nem könyvvizsgált|not audited/i, 'NOT_AUDITED'],
];

/** Egy tény szöveges értéke → a mező típusának megfelelő érték (pénznél az egység szerint). */
export function factValue(key: FactKey, raw: string, unit: FinUnit = 'HUF'): FinFacts[FactKey] | null {
  const spec = FACT_SPEC[key];
  const s = raw.trim();
  switch (spec.kind) {
    case 'bool':
      if (/^(igen|van|true|yes|igaz)/i.test(s)) return true;
      if (/^(nem|nincs|false|no|hamis)/i.test(s)) return false;
      return null;
    case 'money':
      return statedToHuf(s.replace(/(ezer|millió)?\s*(ft|huf|forint)\.?$/i, ''), /millió/i.test(s) ? 'MILLION_HUF' : /ezer/i.test(s) ? 'THOUSAND_HUF' : unit);
    case 'number':
    case 'year': {
      const n = parseNumber(s.replace(/\s*(db|fő|év)\.?$/i, ''));
      return n == null ? null : Math.round(n);
    }
    case 'percent': {
      const n = parseNumber(s.replace('%', ''));
      return n == null ? null : n > 1 ? n / 100 : n;
    }
    case 'date': {
      const m = s.match(/(\d{4})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})/);
      return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
    }
    case 'opinion':
      return OPINION_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
  }
}

export function rawFacts(raw: { key: FactKey; value: string; quote: string }[], unit: FinUnit): ExtractedFact[] {
  return raw.flatMap((f) => {
    const value = factValue(f.key, f.value, unit);
    if (value == null) return [];
    return [{ key: f.key, value: value as string | number | boolean, quote: f.quote, pageIndex: null }];
  });
}
