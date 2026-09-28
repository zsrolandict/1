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

export function getScenario(id: string | undefined): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? GYARTO;
}
