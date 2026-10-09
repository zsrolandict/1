import { z } from 'zod';
import { CoverageLogSchema, CoverageOverridesSchema, MoneySchema } from '@/lib/backupSchema';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { sanitizeAnswers } from '@/lib/intake/checklist';
import { sanitizeRequestStatus } from '@/lib/intake/state';
import type { CoverageLogEntry, CoverageOverrides } from '@/lib/risk/coverage';
import type { RiskItem } from '@/lib/risk/types';
import type { CompanyProfile } from '@/lib/risk/valuation';
import { rowToItem, type RedFlagRow } from './redFlagRow';
import { companyFrom } from './reviewFromDb';

/**
 * Szerveres projekttárolás (0015): a projektlista, egy projekt teljes
 * betöltése és az új projekt kérése. A betöltött adat ugyanazokon a sémákon
 * megy át, mint a böngészős tárolóból betöltéskor – az adatbázisban lévő
 * (pl. kézzel javított) hibás érték így sem jut a motorba.
 */

export interface ProjectSummary {
  id: string;
  code: string;
  companyName: string;
  kind: EngagementKind;
  revision: number;
  updatedAt: string;
}

export interface ServerProject extends ProjectSummary {
  materialityHuf: number;
  company: CompanyProfile;
  coverageOverrides?: CoverageOverrides;
  coverageLog?: CoverageLogEntry[];
  items: RiskItem[];
  answers: Record<string, unknown>;
  requestStatus: Record<string, unknown>;
  /** Az adatgyűjtés többi része (tényállás, iratok, táblák…); null, ha még nem volt mentés. */
  intake: Record<string, unknown> | null;
  snapshots: unknown[];
}

export const CreateProjectSchema = z.object({
  companyName: z.string().trim().min(1).max(300),
  kind: EngagementKindSchema,
  materialityHuf: MoneySchema.optional(),
});

export interface EngagementListRow {
  id: string;
  code: string;
  kind: EngagementKind;
  revision: number;
  updated_at: string;
  companies: { name: string } | null;
}

export function summaryFromRow(r: EngagementListRow): ProjectSummary {
  return { id: r.id, code: r.code, companyName: r.companies?.name ?? r.code, kind: r.kind, revision: r.revision, updatedAt: r.updated_at };
}

export interface EngagementFullRow extends EngagementListRow {
  materiality_huf: number;
  workspace: Record<string, unknown> | null;
}

export function projectFromRows(
  eng: EngagementFullRow,
  flags: RedFlagRow[],
  answers: { answers: unknown; request_status: unknown } | null,
  modules: { module: string; data: unknown }[],
): ServerProject {
  const ws = eng.workspace ?? {};
  const overrides = CoverageOverridesSchema.safeParse(ws.coverageOverrides);
  const log = CoverageLogSchema.safeParse(ws.coverageLog);
  const mod = (name: string) => modules.find((m) => m.module === name)?.data;
  const intake = mod('intake');
  const snapshots = mod('snapshots');
  return {
    ...summaryFromRow(eng),
    materialityHuf: Number(eng.materiality_huf),
    company: companyFrom(ws as { company?: unknown }),
    ...(overrides.success && ws.coverageOverrides !== undefined ? { coverageOverrides: overrides.data as CoverageOverrides } : {}),
    ...(log.success && ws.coverageLog !== undefined ? { coverageLog: log.data } : {}),
    // Csak a felületről mentett tételek (item_key); a régi, kulcs nélküli sorok nem a felület tételei.
    items: ordered(flags.filter((f) => f.item_key).map(rowToItem), ws.itemOrder),
    answers: sanitizeAnswers(answers?.answers).answers,
    requestStatus: sanitizeRequestStatus(answers?.request_status),
    intake: intake && typeof intake === 'object' && !Array.isArray(intake) ? (intake as Record<string, unknown>) : null,
    snapshots: Array.isArray(snapshots) ? snapshots : [],
  };
}

/** A felület sorrendje (a mentéskor rögzített kulcssorrend); ismeretlen tétel a végére. */
function ordered(items: RiskItem[], order: unknown): RiskItem[] {
  if (!Array.isArray(order)) return items;
  const pos = new Map(order.map((id, i) => [String(id), i]));
  return [...items].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
}
