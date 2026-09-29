import { ENGAGEMENT_KINDS, hourSplit, PM_HOURS, type EngagementKind } from '@/lib/engagement/kinds';
import { AUDIT_FEE_HUF } from '@/lib/risk/engine';
import type { Pillar } from '@/lib/risk/types';
import { markSaved, markSaveFailed } from '@/lib/localSave';

/**
 * Óraszám-követés: a ráfordított idő pillérenként a típus keretéhez mérve,
 * a belső költség és a fix díjhoz viszonyított fedezet. Élesben a Supabase
 * `timesheet_entries` / `hour_budgets` táblái adják (0001-es migráció);
 * itt a böngészőben tároljuk, ugyanebben a formában.
 */

export type Bucket = Pillar | 'PM';
export type Role = 'PARTNER' | 'SENIOR' | 'JUNIOR';

export const ROLE_LABEL: Record<Role, string> = { PARTNER: 'Partner', SENIOR: 'Szenior tanácsadó', JUNIOR: 'Junior tanácsadó' };
export const BUCKET_LABEL_PM = 'Projektvezetés';

/** TERVEZET belső óraköltségek (Ft/óra) – a vezetés véglegesíti, a felületen átírható. */
export const DEFAULT_RATES: Record<Role, number> = { PARTNER: 25_000, SENIOR: 15_000, JUNIOR: 9_000 };

export interface TimeEntry {
  id: string;
  date: string; // ÉÉÉÉ-HH-NN
  bucket: Bucket;
  role: Role;
  person: string;
  hours: number;
  note: string;
}

export interface TimesheetState {
  entries: TimeEntry[];
  rates: Record<Role, number>;
  feeHuf: number;
}

export const EMPTY_TIMESHEET: TimesheetState = { entries: [], rates: DEFAULT_RATES, feeHuf: AUDIT_FEE_HUF };

export type BurnLevel = 'OK' | 'WARN' | 'OVER';

export interface BucketBurn {
  bucket: Bucket;
  budget: number;
  used: number;
  /** used / budget (0 kerettel végtelen helyett 0 vagy 1+). */
  ratio: number;
  level: BurnLevel;
}

export interface TimesheetSummary {
  budget: number;
  used: number;
  ratio: number;
  level: BurnLevel;
  buckets: BucketBurn[];
  costHuf: number;
  feeHuf: number;
  marginHuf: number;
  marginPct: number;
  /** A jelenlegi óraköltség-mix mellett a teljes keret felhasználásával várható költség. */
  projectedCostHuf: number;
  warnings: string[];
}

const level = (ratio: number): BurnLevel => (ratio > 1 ? 'OVER' : ratio >= 0.8 ? 'WARN' : 'OK');
const r1 = (x: number) => Math.round(x * 10) / 10;
const h = (x: number) => String(x).replace('.', ',');

export function budgetFor(kind: EngagementKind): { bucket: Bucket; hours: number }[] {
  return [...hourSplit(kind).map((s) => ({ bucket: s.pillar as Bucket, hours: s.hours })), { bucket: 'PM' as Bucket, hours: PM_HOURS }];
}

export function summarize(state: TimesheetState, kind: EngagementKind, labels: Record<Bucket, string>): TimesheetSummary {
  const budget = ENGAGEMENT_KINDS[kind].hourBudget;
  const used = r1(state.entries.reduce((a, e) => a + e.hours, 0));
  const buckets = budgetFor(kind).map(({ bucket, hours }) => {
    const u = r1(state.entries.filter((e) => e.bucket === bucket).reduce((a, e) => a + e.hours, 0));
    const ratio = hours ? u / hours : u > 0 ? 2 : 0;
    return { bucket, budget: hours, used: u, ratio, level: level(ratio) };
  });
  const costHuf = state.entries.reduce((a, e) => a + e.hours * (state.rates[e.role] ?? 0), 0);
  const avgRate = used > 0 ? costHuf / used : state.rates.SENIOR;
  const projectedCostHuf = Math.round(Math.max(used, budget) * avgRate);
  const marginHuf = state.feeHuf - costHuf;
  const ratio = budget ? used / budget : 0;
  const warnings: string[] = [];
  for (const b of buckets) {
    if (b.level === 'OVER') warnings.push(`${labels[b.bucket]}: ${h(b.used)} óra a ${h(b.budget)} órás keretből – túllépés.`);
    else if (b.level === 'WARN') warnings.push(`${labels[b.bucket]}: a keret ${Math.round(b.ratio * 100)}%-a elfogyott.`);
  }
  if (level(ratio) === 'OVER') warnings.unshift(`A teljes ${budget} órás keret túllépve (${h(used)} óra).`);
  if (marginHuf < 0) warnings.push('A belső költség meghaladja a díjat: a projekt veszteséges.');
  return {
    budget,
    used,
    ratio,
    level: level(ratio),
    buckets,
    costHuf: Math.round(costHuf),
    feeHuf: state.feeHuf,
    marginHuf: Math.round(marginHuf),
    marginPct: state.feeHuf ? marginHuf / state.feeHuf : 0,
    projectedCostHuf,
    warnings,
  };
}

export function validateEntry(e: Omit<TimeEntry, 'id'>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return 'Adj meg dátumot.';
  if (!(e.hours > 0)) return 'Az óraszám legyen 0-nál nagyobb.';
  if (e.hours > 12) return 'Egy bejegyzés legfeljebb 12 óra lehet.';
  if (Math.round(e.hours * 4) !== e.hours * 4) return 'Negyedórás pontossággal add meg (pl. 1,25).';
  return null;
}

export function addEntry(state: TimesheetState, e: Omit<TimeEntry, 'id'>, now = Date.now()): TimesheetState {
  const entry: TimeEntry = { ...e, id: `T${now.toString(36)}${Math.random().toString(36).slice(2, 5)}` };
  return { ...state, entries: [entry, ...state.entries].sort((a, b) => b.date.localeCompare(a.date)) };
}

export function removeEntry(state: TimesheetState, id: string): TimesheetState {
  return { ...state, entries: state.entries.filter((e) => e.id !== id) };
}

/** Tárolási kulcs projektenként (a projektszintű műveletek – törlés, mentés fájlba – is ezt használják). */
export const timesheetKey = (scenarioId: string) => `ict-hc:timesheet:v1:${scenarioId}`;

export function loadTimesheet(scenarioId: string): TimesheetState {
  try {
    const raw = localStorage.getItem(timesheetKey(scenarioId));
    if (!raw) return EMPTY_TIMESHEET;
    const s = JSON.parse(raw) as Partial<TimesheetState>;
    return {
      entries: Array.isArray(s.entries) ? s.entries : [],
      rates: { ...DEFAULT_RATES, ...(s.rates ?? {}) },
      feeHuf: typeof s.feeHuf === 'number' ? s.feeHuf : AUDIT_FEE_HUF,
    };
  } catch {
    return EMPTY_TIMESHEET;
  }
}

export function saveTimesheet(scenarioId: string, s: TimesheetState): void {
  try {
    localStorage.setItem(timesheetKey(scenarioId), JSON.stringify(s));
    markSaved();
  } catch {
    markSaveFailed(); // betelt tárhely vagy privát mód: a felület jelzi
  }
}
