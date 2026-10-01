import type { DocumentRecord } from '../documents/types';
import { DOC_TYPES } from '../documents/docTypes';
import type { RequestStatus } from '../requests';
import { FACT_SPEC, FIN_FIELD_LABEL, setFact, setYearValue, type FactKey, type FinancialProfile, type FinFacts, type FinField, type FinSource } from './model';

/**
 * A dokumentumokból kiolvasott számok és tények jóváhagyása. Az AI csak
 * javasol: az érték akkor kerül a pénzügyi alapadatok közé, ha a tanácsadó
 * átveszi – forrásként az irat nevével, oldalával és a szó szerinti idézettel.
 */

export type Pending =
  | { kind: 'value'; key: string; doc: DocumentRecord; field: FinField; year: number; value: number; quote: string; page: string; current?: number }
  | { kind: 'fact'; key: string; doc: DocumentRecord; fact: FactKey; value: FinFacts[FactKey]; quote: string; page: string; current?: FinFacts[FactKey] };

const pageOf = (d: DocumentRecord, i: number | null) => (i != null ? (d.pageLabels[i] ?? '') : '');

export function pendingExtractions(docs: DocumentRecord[], f: FinancialProfile): Pending[] {
  const rejected = new Set(f.rejected);
  const out: Pending[] = [];
  for (const d of docs) {
    const fin = d.analysis.financials;
    if (!fin) continue;
    for (const v of fin.values) {
      const key = `${d.id}:${v.field}:${v.year}`;
      if (rejected.has(key)) continue;
      const y = f.years.find((x) => x.year === v.year);
      const cur = y?.values[v.field];
      if (cur === v.valueHuf && y?.sources[v.field]?.docId === d.id) continue;
      out.push({ kind: 'value', key, doc: d, field: v.field, year: v.year, value: v.valueHuf, quote: v.quote, page: pageOf(d, v.pageIndex), current: cur });
    }
    for (const x of fin.facts) {
      const key = `${d.id}:fact:${x.key}`;
      if (rejected.has(key)) continue;
      const cur = f.facts[x.key];
      if (cur === x.value && f.factSources[x.key]?.docId === d.id) continue;
      out.push({
        kind: 'fact',
        key,
        doc: d,
        fact: x.key,
        value: x.value as FinFacts[FactKey],
        quote: x.quote,
        page: pageOf(d, x.pageIndex),
        current: cur ?? undefined,
      });
    }
  }
  return out;
}

export function docSource(doc: DocumentRecord, page: string, quote: string, by: string | null): FinSource {
  return { kind: 'DOCUMENT', ref: `${doc.fileName}${page ? `, ${page}` : ''}`, quote, docId: doc.id, by, at: new Date().toISOString() };
}

export function acceptPending(f: FinancialProfile, p: Pending, by: string | null): FinancialProfile {
  const src = docSource(p.doc, p.page, p.quote, by);
  return p.kind === 'value' ? setYearValue(f, p.year, p.field, p.value, src) : setFact(f, p.fact, p.value, src);
}

export function rejectPending(f: FinancialProfile, p: Pending): FinancialProfile {
  return { ...f, rejected: [...new Set([...f.rejected, p.key])] };
}

export function pendingLabel(p: Pending): string {
  return p.kind === 'value' ? `${FIN_FIELD_LABEL[p.field]} (${p.year})` : FACT_SPEC[p.fact].label;
}

/** Melyik bekérési tételeket teljesíti a feltöltött irat (az irattípusa szerint). */
export function requestsFor(doc: DocumentRecord): string[] {
  const t = doc.analysis.docType;
  return t ? DOC_TYPES[t].requests : [];
}

/** Feltöltéskor a bekérési tétel „Beérkezett” lesz – kivéve, ha a tanácsadó „Nem releváns”-ra állította. */
export function markReceived(status: Record<string, RequestStatus>, ids: string[]): Record<string, RequestStatus> {
  const next = { ...status };
  for (const id of ids) if (next[id] !== 'NA') next[id] = 'RECEIVED';
  return next;
}
