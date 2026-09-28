import type { Scenario } from '@/lib/scenarios';
import type { TableKind } from '../tables/spec';

/**
 * KITALÁLT mintatáblák a mintaesetekhez, magyar Excel CSV-exportot utánozva
 * (pontosvessző, szóközös ezres tagolás, 2026.05.12. dátum). Ugyanazon a
 * beolvasón mennek át, mint egy feltöltött fájl. Valós céget nem ábrázolnak.
 */

export const SAMPLE_REF_DATE = '2026-06-30';

interface Profile {
  topCustomer: string;
  topSalesShare: number;
  customers: number;
  share90: number;
  /** A 90 napon túli állományból ennyi a legnagyobb késedelmes vevőé. */
  topDebtorOf90: number;
  topSupplier: string;
  topSupplierShare: number;
  related: { partner: string; nature: string; amount: number; doc: boolean }[];
}

const PROFILES: Record<string, Profile> = {
  gyarto: {
    topCustomer: 'Példa Autóipari Beszállító Zrt.', topSalesShare: 0.18, customers: 28,
    share90: 0.12, topDebtorOf90: 0.4,
    topSupplier: 'Példa Acélkereskedő Kft.', topSupplierShare: 0.45,
    related: [
      { partner: 'Példa Holding Kft.', nature: 'Menedzsmentszolgáltatás', amount: 96_000_000, doc: false },
      { partner: 'Példa Ingatlan Kft.', nature: 'Csarnokbérlet', amount: 84_000_000, doc: false },
      { partner: 'Példa Holding Kft.', nature: 'Tagi kölcsön', amount: 150_000_000, doc: false },
      { partner: 'Példa Logisztika Kft.', nature: 'Fuvarozás', amount: 62_000_000, doc: false },
      { partner: 'Példa Ingatlan Kft.', nature: 'Rezsi továbbszámlázás', amount: 18_000_000, doc: false },
    ],
  },
  epitoipar: {
    topCustomer: 'Példa Város Önkormányzata', topSalesShare: 0.38, customers: 16,
    share90: 0.43, topDebtorOf90: 0.85,
    topSupplier: 'Példa Építőanyag Nagykereskedés Zrt.', topSupplierShare: 0.6,
    related: [
      { partner: 'Példa Gépbérlő Kft.', nature: 'Munkagép-bérlet', amount: 120_000_000, doc: true },
      { partner: 'Példa Ingatlanfejlesztő Kft.', nature: 'Kivitelezés', amount: 240_000_000, doc: true },
    ],
  },
  konyvelo: {
    topCustomer: 'Példa Kereskedelmi Kft.', topSalesShare: 0.06, customers: 60,
    share90: 0.08, topDebtorOf90: 0.3,
    topSupplier: 'Példa Szoftverforgalmazó Kft.', topSupplierShare: 0.2,
    related: [
      { partner: 'Alapító (magánszemély)', nature: 'Irodabérlet', amount: 24_000_000, doc: true },
    ],
  },
  'it-fejleszto': {
    topCustomer: 'Példa Bank Zrt.', topSalesShare: 0.55, customers: 14,
    share90: 0.1, topDebtorOf90: 0.5,
    topSupplier: 'Példa Felhőszolgáltató Kft.', topSupplierShare: 0.15,
    related: [
      { partner: 'Példa Tech Holding Kft.', nature: 'Licencdíj', amount: 70_000_000, doc: true },
      { partner: 'Példa Tech Holding Kft.', nature: 'Menedzsmentszolgáltatás', amount: 45_000_000, doc: false },
    ],
  },
};

/** Determinisztikus álvéletlen (a minták minden futáskor egyformák). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const huf = (n: number) => Math.round(n).toLocaleString('hu-HU').replace(/\s/g, ' ');
const DAY = 86_400_000;
const REF = Date.parse(`${SAMPLE_REF_DATE}T00:00:00Z`);
const date = (daysBeforeRef: number) => {
  const d = new Date(REF - daysBeforeRef * DAY);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}.`;
};

/**
 * A legnagyobb után a többi partner összege: csökkenő, mindegyik kisebb a
 * legnagyobbnál, és az összeg pontosan kiadja a teljeset.
 */
function split(total: number, topShare: number, n: number, rand: () => number): number[] {
  const weights = Array.from({ length: n - 1 }, (_, i) => (1 / (i + 1.5)) * (0.7 + rand() * 0.6));
  const cap = topShare * total * 0.95;
  const rest = (1 - topShare) * total;
  const values = new Array<number>(weights.length).fill(0);
  let free = weights.map((_, i) => i);
  let remaining = rest;
  // „vízfeltöltés”: ami a plafon fölé menne, a többiek között oszlik szét
  for (let round = 0; round < 20 && free.length && remaining > 0.5; round++) {
    const sum = free.reduce((s, i) => s + weights[i], 0);
    const next: number[] = [];
    let spill = 0;
    for (const i of free) {
      const v = values[i] + (weights[i] / sum) * remaining;
      if (v > cap) { spill += v - cap; values[i] = cap; } else { values[i] = v; next.push(i); }
    }
    free = next;
    remaining = spill;
  }
  return [topShare * total, ...values];
}

function seedOf(id: string): number {
  return [...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
}

export function hasSampleTables(scenarioId: string): boolean {
  return scenarioId in PROFILES;
}

export function sampleTableCsv(kind: TableKind, sc: Scenario): { fileName: string; csv: string } {
  const p = PROFILES[sc.id] ?? PROFILES.gyarto;
  const rand = rng(seedOf(sc.id + kind));
  const revenue = sc.company.revenueHuf;
  const customerNames = [p.topCustomer, ...Array.from({ length: p.customers - 1 }, (_, i) => `Példa Vevő ${String(i + 1).padStart(2, '0')} Kft.`)];

  switch (kind) {
    case 'SALES_BY_CUSTOMER': {
      const amounts = split(revenue, p.topSalesShare, p.customers, rand);
      const lines = customerNames.map((n, i) => `${n};${huf(amounts[i])}`);
      return { fileName: 'vevonkenti_arbevetel.csv', csv: ['Vevő neve;Nettó árbevétel (Ft)', ...lines, `Összesen;${huf(revenue)}`].join('\n') };
    }
    case 'PURCHASES_BY_SUPPLIER': {
      const purchases = revenue * (1 - sc.company.grossMarginPct) * 0.6;
      const n = 20;
      const amounts = split(purchases, p.topSupplierShare, n, rand);
      const names = [p.topSupplier, ...Array.from({ length: n - 1 }, (_, i) => `Példa Szállító ${String(i + 1).padStart(2, '0')} Kft.`)];
      return { fileName: 'szallitonkenti_beszerzes.csv', csv: ['Szállító;Beszerzés nettó (Ft)', ...names.map((nm, i) => `${nm};${huf(amounts[i])}`)].join('\n') };
    }
    case 'AR_AGING': {
      const total = (revenue * sc.company.actualDsoDays) / 365;
      const over90 = total * p.share90;
      const current = total - over90;
      const lines: string[] = [];
      // 90 napon túli tételek: a legnagyobb késedelmes vevő + két kisebb
      const debtor = p.topDebtorOf90 >= 0.5 ? customerNames[0] : customerNames[3];
      lines.push(`${debtor};${huf(over90 * p.topDebtorOf90 * 0.6)};${date(180)}`);
      lines.push(`${debtor};${huf(over90 * p.topDebtorOf90 * 0.4)};${date(120)}`);
      lines.push(`${customerNames[5]};${huf(over90 * (1 - p.topDebtorOf90) * 0.7)};${date(150)}`);
      lines.push(`${customerNames[8]};${huf(over90 * (1 - p.topDebtorOf90) * 0.3)};${date(95)}`);
      // folyó és 90 napon belül lejárt tételek
      const k = Math.min(customerNames.length, 14);
      const amounts = split(current, 0.2, k, rand);
      amounts.forEach((a, i) => {
        const daysBefore = Math.round(-40 + rand() * 110); // −40 … +70 nap
        lines.push(`${customerNames[i]};${huf(a)};${date(daysBefore)}`);
      });
      return { fileName: 'vevoi_korositas.csv', csv: ['Vevő;Nyitott összeg;Esedékesség', ...lines].join('\n') };
    }
    case 'RELATED_PARTY': {
      const lines = p.related.map((r) => `${r.partner};${r.nature};${huf(r.amount)};${r.doc ? 'igen' : 'nem'}`);
      return { fileName: 'kapcsolt_ugyletek.csv', csv: ['Kapcsolt fél;Ügylet jellege;Ügyletérték (Ft);TP-nyilvántartás', ...lines].join('\n') };
    }
  }
}
