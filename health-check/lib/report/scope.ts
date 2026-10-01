import type { EngagementKind } from '@/lib/engagement/kinds';
import { checklistProgress } from '@/lib/intake/checklist';
import { DOC_TYPES } from '@/lib/intake/documents/docTypes';
import { normalizeFinancials } from '@/lib/intake/financials/model';
import { STATUS_LABEL, type RequestStatus } from '@/lib/intake/requests';
import { requestList, type IntakeState } from '@/lib/intake/state';
import { TABLE_SPECS } from '@/lib/intake/tables/spec';
import { ROLE_LABEL } from '@/lib/interview/questionBank';
import type { InterviewRecords } from '@/lib/interview/records';

/**
 * Vizsgálati terjedelem a riporthoz: mit láttunk (beérkezett iratok,
 * elemzett dokumentumok, táblák, interjúk, beszámoló-évek) és mit nem
 * (bekért, de be nem érkezett iratok). Amit nem láttunk, arról a riport
 * nem állít semmit – ezt a fejezet kimondja.
 */
export interface ReportScope {
  requests: { title: string; status: RequestStatus; statusLabel: string; required: boolean }[];
  documents: { fileName: string; type: string }[];
  tables: string[];
  interviews: { who: string; heldAt: string | null; analyzed: boolean }[];
  financialYears: number[];
  checklist: { answered: number; total: number };
}

export function buildScope(intake: IntakeState, kind: EngagementKind, records: InterviewRecords = {}): ReportScope {
  const status = (id: string): RequestStatus => intake.requestStatus[id] ?? 'REQUESTED';
  const fin = normalizeFinancials(intake.financials);
  const p = checklistProgress(intake.answers, intake.profile.sectors);
  return {
    requests: requestList(intake, kind).map((d) => ({
      title: d.title,
      status: status(d.id),
      statusLabel: STATUS_LABEL[status(d.id)],
      required: d.priority === 'REQUIRED',
    })),
    documents: intake.documents.map((d) => ({
      fileName: d.fileName,
      type: d.analysis.docType && d.analysis.docType !== 'AUTO' ? DOC_TYPES[d.analysis.docType].label : d.analysis.documentType,
    })),
    tables: Object.values(intake.tables).map((t) => `${TABLE_SPECS[t!.kind].label} (${t!.fileName})`),
    interviews: Object.values(records)
      .filter((r) => r && (r.transcript || r.analysis))
      .map((r) => ({ who: r.alias || ROLE_LABEL[r.role], heldAt: r.heldAt, analyzed: Boolean(r.analysis) })),
    financialYears: fin.years.filter((y) => Object.keys(y.values).length).map((y) => y.year),
    checklist: { answered: p.answered, total: p.total },
  };
}

export function scopeCounts(s: ReportScope) {
  const by = (st: RequestStatus) => s.requests.filter((r) => r.status === st);
  return { received: by('RECEIVED'), missing: by('MISSING'), open: by('REQUESTED'), na: by('NA') };
}
