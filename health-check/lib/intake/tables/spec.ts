import { normalize } from '@/lib/interview/transcript';
import type { Grid } from './parse';

/** A támogatott táblatípusok és elvárt oszlopaik. */
export type TableKind = 'AR_AGING' | 'SALES_BY_CUSTOMER' | 'PURCHASES_BY_SUPPLIER' | 'RELATED_PARTY';

export type ColumnKey = 'partner' | 'amount' | 'dueDate' | 'daysOverdue' | 'nature' | 'hasDoc';

export interface ColumnSpec {
  key: ColumnKey;
  label: string;
  required: boolean;
  /** Fejléc-szinonimák (ékezet- és kisbetű-függetlenül, részszóként is illeszkednek). */
  synonyms: string[];
}

export interface TableSpec {
  kind: TableKind;
  label: string;
  /** Mit kérünk az ügyféltől. */
  request: string;
  columns: ColumnSpec[];
  /** Legalább az egyik oszlopnak meg kell lennie (pl. esedékesség VAGY késés napokban). */
  oneOf?: ColumnKey[];
}

const PARTNER = (extra: string[]): ColumnSpec => ({
  key: 'partner', label: 'Partner neve', required: true,
  synonyms: [...extra, 'partner', 'nev', 'megnevezes'],
});

export const TABLE_SPECS: Record<TableKind, TableSpec> = {
  AR_AGING: {
    kind: 'AR_AGING',
    label: 'Vevői korosítás (nyitott tételek)',
    request: 'Nyitott vevői számlák a fordulónapon: vevő, nyitott összeg, esedékesség.',
    columns: [
      PARTNER(['vevo', 'ugyfel', 'megrendelo']),
      { key: 'amount', label: 'Nyitott összeg', required: true, synonyms: ['nyitott', 'egyenleg', 'fennallo', 'tartozas', 'osszeg', 'ertek'] },
      { key: 'dueDate', label: 'Esedékesség', required: false, synonyms: ['esedekesseg', 'lejarat', 'fizetesi hatarido', 'hatarido', 'esedekes'] },
      { key: 'daysOverdue', label: 'Késés (nap)', required: false, synonyms: ['keses', 'lejart nap', 'kesedelem', 'napok'] },
    ],
    oneOf: ['dueDate', 'daysOverdue'],
  },
  SALES_BY_CUSTOMER: {
    kind: 'SALES_BY_CUSTOMER',
    label: 'Vevőnkénti árbevétel (12 hónap)',
    request: 'Az utolsó lezárt 12 hónap nettó árbevétele vevőnként.',
    columns: [
      PARTNER(['vevo', 'ugyfel', 'megrendelo']),
      { key: 'amount', label: 'Nettó árbevétel', required: true, synonyms: ['arbevetel', 'forgalom', 'netto', 'osszeg', 'ertek'] },
    ],
  },
  PURCHASES_BY_SUPPLIER: {
    kind: 'PURCHASES_BY_SUPPLIER',
    label: 'Szállítónkénti beszerzés (12 hónap)',
    request: 'Az utolsó lezárt 12 hónap beszerzései szállítónként.',
    columns: [
      PARTNER(['szallito', 'beszallito']),
      { key: 'amount', label: 'Beszerzési érték', required: true, synonyms: ['beszerzes', 'forgalom', 'netto', 'osszeg', 'ertek'] },
    ],
  },
  RELATED_PARTY: {
    kind: 'RELATED_PARTY',
    label: 'Kapcsolt ügyletek',
    request: 'Kapcsolt felekkel kötött ügyletek az elmúlt 2 évben: fél, ügylet, érték, van-e transzferár-nyilvántartás.',
    columns: [
      PARTNER(['kapcsolt fel', 'kapcsolt vallalkozas']),
      { key: 'nature', label: 'Ügylet jellege', required: false, synonyms: ['ugylet', 'jelleg', 'targy', 'tipus'] },
      { key: 'amount', label: 'Ügyletérték', required: true, synonyms: ['ertek', 'osszeg', 'ellenertek', 'netto'] },
      { key: 'hasDoc', label: 'TP-nyilvántartás', required: true, synonyms: ['nyilvantartas', 'dokumentacio', 'transzferar', 'tp'] },
    ],
  },
};

export const TABLE_KINDS = Object.keys(TABLE_SPECS) as TableKind[];

export type ColumnMapping = Partial<Record<ColumnKey, number>>;

export interface DetectedTable {
  headerRow: number;
  headers: string[];
  mapping: ColumnMapping;
}

function matchColumn(spec: ColumnSpec, header: string): number {
  const h = normalize(header);
  if (!h) return 0;
  let best = 0;
  spec.synonyms.forEach((syn, i) => {
    if (h === syn) best = Math.max(best, 100 - i);
    else if (h.split(' ').includes(syn) || (syn.length >= 4 && h.includes(syn))) best = Math.max(best, 50 - i);
  });
  return best;
}

/**
 * Fejlécsor és oszlop-hozzárendelés felismerése az első 10 sorban.
 * Egy oszlop csak egy mezőhöz tartozhat; a szakértő a felületen javíthatja.
 */
export function detectColumns(kind: TableKind, grid: Grid): DetectedTable {
  const spec = TABLE_SPECS[kind];
  let best: DetectedTable = { headerRow: 0, headers: (grid[0] ?? []).map((c) => String(c ?? '')), mapping: {} };
  let bestScore = -1;
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const headers = grid[r].map((c) => String(c ?? ''));
    const candidates: { key: ColumnKey; col: number; score: number }[] = [];
    for (const col of spec.columns) {
      headers.forEach((h, i) => {
        const score = matchColumn(col, h);
        if (score > 0) candidates.push({ key: col.key, col: i, score });
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    const mapping: ColumnMapping = {};
    const used = new Set<number>();
    let total = 0;
    for (const c of candidates) {
      if (mapping[c.key] !== undefined || used.has(c.col)) continue;
      mapping[c.key] = c.col;
      used.add(c.col);
      total += c.score;
    }
    if (total > bestScore) {
      bestScore = total;
      best = { headerRow: r, headers, mapping };
    }
  }
  return best;
}

/** Hiányzó kötelező oszlopok listája (üres = a tábla feldolgozható). */
export function missingColumns(kind: TableKind, mapping: ColumnMapping): string[] {
  const spec = TABLE_SPECS[kind];
  const missing = spec.columns.filter((c) => c.required && mapping[c.key] === undefined).map((c) => c.label);
  if (spec.oneOf && !spec.oneOf.some((k) => mapping[k] !== undefined)) {
    missing.push(spec.oneOf.map((k) => spec.columns.find((c) => c.key === k)!.label).join(' vagy '));
  }
  return missing;
}
