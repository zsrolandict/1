import type { Pillar } from '@/lib/risk/types';
import type { DocType } from './docTypes';
import type { DocumentRecord } from './types';

/**
 * Melyik pillérhez tartozik egy irat (a szerveres tárolás jogosultságához: a
 * szakértő csak a saját pillére iratait látja). Az irattípus dönt; ismeretlen
 * típusnál az elemzés megállapításainak többsége.
 */
const BY_TYPE: Partial<Record<DocType, Pillar>> = {
  FIN_STATEMENT: 'FINANCE',
  NOTES: 'FINANCE',
  AUDIT_REPORT: 'FINANCE',
  MGMT_LETTER: 'FINANCE',
  BUSINESS_REPORT: 'FINANCE',
  INTERIM: 'FINANCE',
  TAX_ACCOUNT: 'FINANCE',
  TAX_AUDIT: 'FINANCE',
  TAX_RETURN: 'FINANCE',
  LOAN: 'FINANCE',
  GRANT: 'FINANCE',
  RESOLUTION: 'LEGAL',
  ARTICLES: 'LEGAL',
  SHAREHOLDER_AGREEMENT: 'LEGAL',
  CUSTOMER_CONTRACT: 'LEGAL',
  SUPPLIER_CONTRACT: 'LEGAL',
  LEASE: 'LEGAL',
  INSURANCE: 'LEGAL',
  DATA_PROTECTION: 'LEGAL',
  LITIGATION: 'LEGAL',
  EMPLOYMENT: 'HR',
};

export function documentPillar(doc: Pick<DocumentRecord, 'analysis'>): Pillar {
  const byType = doc.analysis?.docType ? BY_TYPE[doc.analysis.docType] : undefined;
  if (byType) return byType;
  const count = new Map<Pillar, number>();
  for (const x of [...(doc.analysis?.findings ?? []), ...(doc.analysis?.facts ?? [])]) count.set(x.pillar, (count.get(x.pillar) ?? 0) + 1);
  // Bizalmasabb pillér előnyben holtversenynél (HR > jog > pénzügy > működés).
  const order: Pillar[] = ['HR', 'LEGAL', 'FINANCE', 'OPERATIONS'];
  let best: Pillar = 'OPERATIONS';
  let n = 0;
  for (const p of order) if ((count.get(p) ?? 0) > n) [best, n] = [p, count.get(p)!];
  return best;
}
