import { assess, type EngineOptions } from './engine';
import { applyFixes } from './simulate';
import type { Rag, RemediationStatus, RiskAssessment, RiskItem } from './types';
import { markSaved } from '@/lib/localSave';

/**
 * Utókövetés: a kiinduló állapot (pillanatkép) és a mostani összevetése.
 * A „Kész” javítási állapotú tétel megoldottnak számít; az „Elfogadott
 * kockázat” marad, de jelöljük (a vezetés tudatosan vállalta).
 */

export const REMEDIATION_LABEL: Record<RemediationStatus, string> = {
  OPEN: 'Nyitott',
  IN_PROGRESS: 'Folyamatban',
  DONE: 'Kész',
  ACCEPTED_RISK: 'Elfogadott kockázat',
};

export interface SnapshotItem {
  id: string;
  code: string;
  title: string;
  rag: Rag;
  score: number;
  expectedLossHuf: number;
}

export interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  kind: string;
  totals: RiskAssessment['totals'];
  items: SnapshotItem[];
}

export function takeSnapshot(result: RiskAssessment, label: string, kind: string, now = new Date()): Snapshot {
  return {
    id: `S${now.getTime().toString(36)}`,
    label,
    createdAt: now.toISOString(),
    kind,
    totals: result.totals,
    items: result.risks.map((r) => ({ id: r.id, code: r.code, title: r.title, rag: r.rag, score: r.score, expectedLossHuf: r.expectedLossHuf })),
  };
}

/** A mostani állapot a javítások figyelembevételével („Kész” = megoldva). */
export function currentAfterRemediation(items: RiskItem[], opts: Partial<EngineOptions>): RiskAssessment {
  const done = new Set(items.filter((r) => r.remediationStatus === 'DONE').map((r) => r.id));
  return assess(applyFixes(items, done, 'RESOLVE'), opts);
}

export type ChangeKind = 'RESOLVED' | 'IMPROVED' | 'UNCHANGED' | 'WORSENED' | 'NEW' | 'ACCEPTED';

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  RESOLVED: 'Megoldva',
  IMPROVED: 'Javult',
  UNCHANGED: 'Változatlan',
  WORSENED: 'Romlott',
  NEW: 'Új tétel',
  ACCEPTED: 'Elfogadott kockázat',
};

export interface Change {
  id: string;
  code: string;
  title: string;
  before: SnapshotItem | null;
  after: { rag: Rag; score: number; expectedLossHuf: number } | null;
  change: ChangeKind;
  status: RemediationStatus;
}

export interface Comparison {
  snapshot: Snapshot;
  now: RiskAssessment['totals'];
  changes: Change[];
  counts: Record<ChangeKind, number>;
}

export function compare(snapshot: Snapshot, items: RiskItem[], opts: Partial<EngineOptions>): Comparison {
  const nowAssessment = currentAfterRemediation(items, opts);
  const nowById = new Map(nowAssessment.risks.map((r) => [r.id, r]));
  const itemById = new Map(items.map((r) => [r.id, r]));
  const changes: Change[] = [];
  const seen = new Set<string>();
  for (const b of snapshot.items) {
    seen.add(b.id);
    const n = nowById.get(b.id);
    const status = itemById.get(b.id)?.remediationStatus ?? 'OPEN';
    let change: ChangeKind;
    if (!n) change = 'RESOLVED';
    else if (status === 'ACCEPTED_RISK') change = 'ACCEPTED';
    else if (n.score < b.score) change = 'IMPROVED';
    else if (n.score > b.score) change = 'WORSENED';
    else change = 'UNCHANGED';
    changes.push({ id: b.id, code: b.code, title: b.title, before: b, after: n ? { rag: n.rag, score: n.score, expectedLossHuf: n.expectedLossHuf } : null, change, status });
  }
  for (const n of nowAssessment.risks) {
    if (seen.has(n.id)) continue;
    changes.push({ id: n.id, code: n.code, title: n.title, before: null, after: { rag: n.rag, score: n.score, expectedLossHuf: n.expectedLossHuf }, change: 'NEW', status: itemById.get(n.id)?.remediationStatus ?? 'OPEN' });
  }
  const order: Record<ChangeKind, number> = { WORSENED: 0, NEW: 1, UNCHANGED: 2, ACCEPTED: 3, IMPROVED: 4, RESOLVED: 5 };
  changes.sort((x, y) => order[x.change] - order[y.change]);
  const counts = { RESOLVED: 0, IMPROVED: 0, UNCHANGED: 0, WORSENED: 0, NEW: 0, ACCEPTED: 0 } as Record<ChangeKind, number>;
  for (const c of changes) counts[c.change]++;
  return { snapshot, now: nowAssessment.totals, changes, counts };
}

const key = (scenarioId: string) => `ict-hc:snapshots:v1:${scenarioId}`;

export function loadSnapshots(scenarioId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(key(scenarioId));
    return raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    return [];
  }
}

export function saveSnapshots(scenarioId: string, list: Snapshot[]): void {
  try {
    localStorage.setItem(key(scenarioId), JSON.stringify(list));
    markSaved();
  } catch {
    /* privát mód */
  }
}
