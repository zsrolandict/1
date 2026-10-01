/**
 * Pénzügyi alapadatok egy projekthez: a beszámoló kulcsszámai (legfeljebb
 * 3 év) és a beírható tények (könyvvizsgálat, adó, finanszírozás, jogviták…).
 * Minden értékhez forrás tartozik („honnan tudjuk”): irat oldallal és
 * idézettel, interjú, az ügyfél szóbeli közlése vagy kézi bevitel.
 * Az összegek forintban vannak (a beszámoló ezer Ft-os adatait átváltjuk).
 */

export type FinField =
  | 'revenue'
  | 'materialCosts'
  | 'personnelCosts'
  | 'depreciation'
  | 'operatingProfit'
  | 'netProfit'
  | 'equity'
  | 'shareCapital'
  | 'provisions'
  | 'longTermLiabilities'
  | 'shortTermLiabilities'
  | 'cash'
  | 'receivables'
  | 'payables'
  | 'inventory'
  | 'currentAssets';

export const FIN_FIELDS: { field: FinField; label: string; group: 'Eredménykimutatás' | 'Mérleg' }[] = [
  { field: 'revenue', label: 'Értékesítés nettó árbevétele', group: 'Eredménykimutatás' },
  { field: 'materialCosts', label: 'Anyagjellegű ráfordítások', group: 'Eredménykimutatás' },
  { field: 'personnelCosts', label: 'Személyi jellegű ráfordítások', group: 'Eredménykimutatás' },
  { field: 'depreciation', label: 'Értékcsökkenési leírás', group: 'Eredménykimutatás' },
  { field: 'operatingProfit', label: 'Üzemi (üzleti) tevékenység eredménye', group: 'Eredménykimutatás' },
  { field: 'netProfit', label: 'Adózott eredmény', group: 'Eredménykimutatás' },
  { field: 'equity', label: 'Saját tőke', group: 'Mérleg' },
  { field: 'shareCapital', label: 'Jegyzett tőke', group: 'Mérleg' },
  { field: 'provisions', label: 'Céltartalékok', group: 'Mérleg' },
  { field: 'longTermLiabilities', label: 'Hosszú lejáratú kötelezettségek', group: 'Mérleg' },
  { field: 'shortTermLiabilities', label: 'Rövid lejáratú kötelezettségek', group: 'Mérleg' },
  { field: 'currentAssets', label: 'Forgóeszközök', group: 'Mérleg' },
  { field: 'cash', label: 'Pénzeszközök', group: 'Mérleg' },
  { field: 'receivables', label: 'Követelések áruszállításból (vevők)', group: 'Mérleg' },
  { field: 'payables', label: 'Kötelezettségek áruszállításból (szállítók)', group: 'Mérleg' },
  { field: 'inventory', label: 'Készletek', group: 'Mérleg' },
];

export const FIN_FIELD_LABEL = Object.fromEntries(FIN_FIELDS.map((f) => [f.field, f.label])) as Record<FinField, string>;
export const isFinField = (s: string): s is FinField => s in FIN_FIELD_LABEL;

export type AuditOpinion = 'UNQUALIFIED' | 'QUALIFIED' | 'ADVERSE' | 'DISCLAIMER' | 'NOT_AUDITED';

export const AUDIT_OPINION_LABEL: Record<AuditOpinion, string> = {
  UNQUALIFIED: 'Minősítés nélküli (tiszta) vélemény',
  QUALIFIED: 'Minősített (korlátozott) vélemény',
  ADVERSE: 'Ellenvélemény',
  DISCLAIMER: 'Véleménynyilvánítás visszautasítása',
  NOT_AUDITED: 'Nem könyvvizsgált',
};

/** Beírható tények. `null` / hiányzik = nem tudjuk. */
export interface FinFacts {
  auditOpinion?: AuditOpinion | null;
  goingConcern?: boolean | null;
  emphasisOfMatter?: boolean | null;
  managementLetterIssues?: number | null;
  filingDate?: string | null;
  dividendHuf?: number | null;
  taxDebtHuf?: number | null;
  taxClean?: boolean | null;
  lastTaxAuditYear?: number | null;
  lastTaxAuditFinding?: boolean | null;
  selfRevisions?: number | null;
  contingentHuf?: number | null;
  litigationCount?: number | null;
  litigationHuf?: number | null;
  relatedPartyInNotes?: boolean | null;
  pledges?: boolean | null;
  grantHuf?: number | null;
  grantSustainUntil?: string | null;
  grantOwnerChangeConsent?: boolean | null;
  loanHuf?: number | null;
  loanMaturity?: string | null;
  covenantsOk?: boolean | null;
  loanChangeOfControl?: boolean | null;
  ownerLoansHuf?: number | null;
  avgHeadcount?: number | null;
  keyPeople?: number | null;
  turnoverPct?: number | null;
  liabilityInsurance?: boolean | null;
  insuranceLimitHuf?: number | null;
}

export type FactKey = keyof FinFacts;
export type FactKind = 'money' | 'number' | 'percent' | 'bool' | 'date' | 'year' | 'opinion';

export interface FactSpec {
  key: FactKey;
  label: string;
  kind: FactKind;
  hint?: string;
}

export const FACT_GROUPS: { title: string; anchor: string; facts: FactSpec[] }[] = [
  {
    title: 'Könyvvizsgálat és beszámoló',
    anchor: 'fin-audit',
    facts: [
      { key: 'auditOpinion', label: 'Könyvvizsgálói vélemény', kind: 'opinion' },
      { key: 'goingConcern', label: 'Lényeges bizonytalanság a vállalkozás folytatására', kind: 'bool' },
      { key: 'emphasisOfMatter', label: 'Figyelemfelhívás a jelentésben', kind: 'bool' },
      { key: 'managementLetterIssues', label: 'Vezetői levélben jelzett hiányosság (db)', kind: 'number' },
      { key: 'filingDate', label: 'A beszámoló letétbe helyezésének dátuma', kind: 'date', hint: 'Határidő: a mérlegfordulónapot követő május 31.' },
      { key: 'dividendHuf', label: 'Jóváhagyott osztalék', kind: 'money' },
    ],
  },
  {
    title: 'Adó és hatóság',
    anchor: 'fin-tax',
    facts: [
      { key: 'taxDebtHuf', label: 'NAV-tartozás a folyószámlán', kind: 'money' },
      { key: 'taxClean', label: 'Szerepel a köztartozásmentes adózói adatbázisban', kind: 'bool' },
      { key: 'lastTaxAuditYear', label: 'Utolsó NAV-ellenőrzés éve', kind: 'year' },
      { key: 'lastTaxAuditFinding', label: 'Az utolsó ellenőrzés megállapítással zárult', kind: 'bool' },
      { key: 'selfRevisions', label: 'Önellenőrzések száma (2 év)', kind: 'number' },
    ],
  },
  {
    title: 'Jogviták és függő kötelezettségek',
    anchor: 'fin-legal',
    facts: [
      { key: 'contingentHuf', label: 'Függő kötelezettségek (kezesség, garancia)', kind: 'money' },
      { key: 'litigationCount', label: 'Folyamatban lévő perek száma', kind: 'number' },
      { key: 'litigationHuf', label: 'Perérték összesen', kind: 'money' },
      { key: 'relatedPartyInNotes', label: 'A melléklet kapcsolt ügyletet mutat be', kind: 'bool' },
      { key: 'pledges', label: 'Zálogjog terheli az eszközöket', kind: 'bool' },
    ],
  },
  {
    title: 'Finanszírozás és támogatás',
    anchor: 'fin-funding',
    facts: [
      { key: 'loanHuf', label: 'Hitel- és lízingállomány', kind: 'money' },
      { key: 'loanMaturity', label: 'A legközelebbi hitellejárat', kind: 'date' },
      { key: 'covenantsOk', label: 'A hitelkovenánsok teljesülnek', kind: 'bool' },
      { key: 'loanChangeOfControl', label: 'A hitelszerződésben tulajdonosváltási záradék van', kind: 'bool' },
      { key: 'ownerLoansHuf', label: 'Tagi / tulajdonosi kölcsön egyenlege', kind: 'money' },
      { key: 'grantHuf', label: 'Elnyert támogatás összege', kind: 'money' },
      { key: 'grantSustainUntil', label: 'A fenntartási kötelezettség vége', kind: 'date' },
      { key: 'grantOwnerChangeConsent', label: 'Tulajdonosváltáshoz a támogató hozzájárulása kell', kind: 'bool' },
    ],
  },
  {
    title: 'Létszám és biztosítás',
    anchor: 'fin-other',
    facts: [
      { key: 'avgHeadcount', label: 'Átlagos statisztikai létszám (melléklet)', kind: 'number' },
      { key: 'keyPeople', label: 'Kulcsemberek száma', kind: 'number' },
      { key: 'turnoverPct', label: 'Éves fluktuáció', kind: 'percent' },
      { key: 'liabilityInsurance', label: 'Van felelősségbiztosítás', kind: 'bool' },
      { key: 'insuranceLimitHuf', label: 'Felelősségbiztosítási limit', kind: 'money' },
    ],
  },
];

export const FACT_SPEC = Object.fromEntries(FACT_GROUPS.flatMap((g) => g.facts).map((f) => [f.key, f])) as Record<FactKey, FactSpec>;
export const isFactKey = (s: string): s is FactKey => s in FACT_SPEC;

export type FinSourceKind = 'DOCUMENT' | 'MANUAL' | 'CLIENT_ORAL' | 'INTERVIEW' | 'PUBLIC';

export const FIN_SOURCE_LABEL: Record<FinSourceKind, string> = {
  DOCUMENT: 'Irat',
  MANUAL: 'Kézi bevitel',
  CLIENT_ORAL: 'Ügyfél szóbeli közlése',
  INTERVIEW: 'Interjú',
  PUBLIC: 'Nyilvános adat',
};

export interface FinSource {
  kind: FinSourceKind;
  /** „Beszamolo_2025.pdf, 2. oldal” vagy szabad szöveg. */
  ref: string;
  quote?: string;
  /** A forrásdokumentum azonosítója (ugráshoz). */
  docId?: string;
  by?: string | null;
  at: string;
}

export interface FinYear {
  year: number;
  values: Partial<Record<FinField, number>>;
  sources: Partial<Record<FinField, FinSource>>;
}

export interface FinancialProfile {
  years: FinYear[];
  facts: FinFacts;
  factSources: Partial<Record<FactKey, FinSource>>;
  /** Elvetett kiolvasott értékek kulcsai (dokumentum-azonosító + mező), hogy ne kérdezzünk rá újra. */
  rejected: string[];
}

export const EMPTY_FINANCIALS: FinancialProfile = { years: [], facts: {}, factSources: {}, rejected: [] };

export function normalizeFinancials(f: Partial<FinancialProfile> | null | undefined): FinancialProfile {
  if (!f || typeof f !== 'object') return EMPTY_FINANCIALS;
  const years = Array.isArray(f.years)
    ? f.years
        .filter((y) => y && Number.isFinite(y.year))
        .map((y) => ({ year: y.year, values: y.values ?? {}, sources: y.sources ?? {} }))
        .sort((a, b) => b.year - a.year)
    : [];
  return {
    years,
    facts: f.facts && typeof f.facts === 'object' ? f.facts : {},
    factSources: f.factSources && typeof f.factSources === 'object' ? f.factSources : {},
    rejected: Array.isArray(f.rejected) ? f.rejected : [],
  };
}

export function hasFinancials(f: FinancialProfile): boolean {
  return f.years.some((y) => Object.keys(y.values).length > 0) || Object.values(f.facts).some((v) => v != null);
}

/** Érték beállítása egy évre (új év esetén létrehozza), forrással. */
export function setYearValue(f: FinancialProfile, year: number, field: FinField, value: number | null, source: FinSource): FinancialProfile {
  const exists = f.years.some((y) => y.year === year);
  const years = (exists ? f.years : [...f.years, { year, values: {}, sources: {} }]).map((y) => {
    if (y.year !== year) return y;
    const values = { ...y.values };
    const sources = { ...y.sources };
    if (value == null) {
      delete values[field];
      delete sources[field];
    } else {
      values[field] = value;
      sources[field] = source;
    }
    return { ...y, values, sources };
  });
  return { ...f, years: years.sort((a, b) => b.year - a.year).slice(0, 3) };
}

export function setFact<K extends FactKey>(f: FinancialProfile, key: K, value: FinFacts[K] | null, source: FinSource): FinancialProfile {
  const facts = { ...f.facts, [key]: value };
  const factSources = { ...f.factSources };
  if (value == null) delete factSources[key];
  else factSources[key] = source;
  return { ...f, facts, factSources };
}

// ── Mutatók ──────────────────────────────────────────────────────

export interface YearRatios {
  year: number;
  ebitda: number | null;
  ebitdaMargin: number | null;
  /** (Hosszú + rövid lejáratú kötelezettség − pénzeszköz) / EBITDA. */
  netDebtToEbitda: number | null;
  /** Forgóeszköz / rövid lejáratú kötelezettség. */
  currentRatio: number | null;
  equityToShareCapital: number | null;
  /** Vevők / árbevétel × 365. */
  dso: number | null;
  /** Szállítók / anyagjellegű ráfordítás × 365. */
  dpo: number | null;
  /** Árbevétel-változás az előző évhez képest. */
  revenueChange: number | null;
  /** (Árbevétel − anyag- és személyi jellegű ráfordítás) / árbevétel – a fedezeti hányad közelítése. */
  grossMargin: number | null;
}

const ratio = (a: number | undefined, b: number | undefined) => (a != null && b != null && b !== 0 ? a / b : null);

export function yearRatios(f: FinancialProfile): YearRatios[] {
  return f.years.map((y, i) => {
    const v = y.values;
    const prev = f.years[i + 1];
    const ebitda = v.operatingProfit != null && v.depreciation != null ? v.operatingProfit + v.depreciation : null;
    const debt = (v.longTermLiabilities ?? 0) + (v.shortTermLiabilities ?? 0);
    const hasDebt = v.longTermLiabilities != null || v.shortTermLiabilities != null;
    return {
      year: y.year,
      ebitda,
      ebitdaMargin: ebitda != null ? ratio(ebitda, v.revenue) : null,
      netDebtToEbitda: hasDebt && ebitda != null && ebitda > 0 ? (debt - (v.cash ?? 0)) / ebitda : null,
      currentRatio: ratio(v.currentAssets, v.shortTermLiabilities),
      equityToShareCapital: ratio(v.equity, v.shareCapital),
      dso: v.receivables != null && v.revenue ? (v.receivables / v.revenue) * 365 : null,
      dpo: v.payables != null && v.materialCosts ? (v.payables / v.materialCosts) * 365 : null,
      revenueChange: prev?.values.revenue && v.revenue != null ? v.revenue / prev.values.revenue - 1 : null,
      grossMargin: v.revenue && v.materialCosts != null ? (v.revenue - v.materialCosts - (v.personnelCosts ?? 0)) / v.revenue : null,
    };
  });
}
