import { SAMPLE_ANALYSIS_RAW, SAMPLE_FACTS, SAMPLE_MISSING_DOCUMENTS, SAMPLE_NOTES } from '@/lib/interview/sample';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { DEFAULT_COMPANY } from '@/lib/risk/valuation';
import { EPITOIPAR } from './epitoipar';
import { IT_FEJLESZTO } from './it-fejleszto';
import { KONYVELO } from './konyvelo';
import type { Scenario } from './types';

export type { Scenario } from './types';

/** Az eredeti általános minta (gyártó cég). */
export const GYARTO: Scenario = {
  id: 'gyarto',
  label: 'Gyártó cég (általános minta)',
  sector: 'Fémfeldolgozás, gépgyártás',
  situation: 'A tulajdonos eladásra készül; eladói átvilágítás a vevői kérdések előtt.',
  companyName: 'Minta Gyártó Kft.',
  sectors: ['MANUFACTURING'],
  kind: 'VENDOR_DD',
  company: DEFAULT_COMPANY,
  materialityHuf: 50_000_000,
  items: DEFAULT_CATALOG,
  facts: SAMPLE_FACTS,
  missingDocuments: SAMPLE_MISSING_DOCUMENTS,
  interview: { role: 'OWNER_CEO', notes: SAMPLE_NOTES, analysis: SAMPLE_ANALYSIS_RAW },
};

export const SCENARIOS: Scenario[] = [GYARTO, EPITOIPAR, KONYVELO, IT_FEJLESZTO];

/**
 * Saját (valós) projekt kiindulópontja: a teljes katalógus, egyetlen
 * azonosított tétel nélkül, mintaadatok (tények, interjú) nélkül.
 */
export const BLANK: Scenario = {
  id: 'ures',
  label: 'Üres projekt',
  sector: '',
  situation: '',
  companyName: '',
  kind: 'HEALTH_CHECK',
  // Nincs kitalált árbevétel: amíg a tanácsadó meg nem adja, nincs forintosítás.
  company: { revenueHuf: 0, grossMarginPct: DEFAULT_COMPANY.grossMarginPct, actualDsoDays: 0, industryDsoDays: 0 },
  materialityHuf: 50_000_000,
  items: DEFAULT_CATALOG.map((r) => ({ ...r, identified: false })),
  facts: [],
  missingDocuments: [],
};

export function isDemoScenario(id: string | undefined): boolean {
  return SCENARIOS.some((s) => s.id === id);
}

export function getScenario(id: string | undefined): Scenario {
  if (id === BLANK.id) return BLANK;
  return SCENARIOS.find((s) => s.id === id) ?? GYARTO;
}
