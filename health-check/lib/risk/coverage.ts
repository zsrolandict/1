import { CHECKLIST, isVisible, type ChecklistAnswers } from '@/lib/intake/checklist';
import { buildRequestList, type CaseProfile, type DocRequest, type RequestStatus } from '@/lib/intake/requests';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { loadIntake } from '@/lib/intake/state';
import type { Sector } from '@/lib/intake/requests';
import type { Pillar } from './types';

/**
 * Vizsgálati lefedettség (audit K2). A Health Score csak azt méri, amit
 * megvizsgáltunk; a hiányt ez a mutató és a minősítési kapu kezeli:
 *  - pillérlefedettség = a megválaszolt kérdések és a beérkezett kötelező
 *    iratok arányának átlaga (ha csak az egyik értelmezhető, az);
 *  - a szakértő felülbírálhatja (vizsgált / nem vizsgált) kötelező
 *    indoklással; minden felülbírálás a lefedettségi naplóba kerül;
 *  - pillér < 50% és nincs azonosított tétele → „Nem vizsgált”: kiesik a
 *    pontszám nevezőjéből (nem ad 100-at);
 *  - összesített (súlyozott) lefedettség < 80% → „Részleges / nem minősített
 *    felmérés”: a minősítés nem lehet Zöld.
 * A két küszöb kezdő feltevés (Feltevések lista).
 */

export { COVERAGE_GATE, COVERAGE_PILLAR_MIN } from './coverageRules';

export type CoverageState = 'EXAMINED' | 'NOT_EXAMINED';

export interface CoverageOverride {
  state: CoverageState;
  reason: string;
  by: string | null;
  at: string;
}

export type CoverageOverrides = Partial<Record<Pillar, CoverageOverride>>;

/** Lefedettségi napló: ki, mikor, melyik pillérnél bírálta felül az automatikus értéket, és miért. */
export interface CoverageLogEntry {
  pillar: Pillar;
  /** AUTO = az automatikus (kérdőív + iratok) érték. */
  from: CoverageState | 'AUTO';
  to: CoverageState | 'AUTO';
  reason: string;
  by: string | null;
  at: string;
}

export interface PillarCoverage {
  pillar: Pillar;
  questions: { answered: number; total: number };
  documents: { received: number; total: number };
  /** A kérdőívből és az iratokból számolt érték (0–1). */
  measured: number;
  /** Az érvényes érték: felülbírálás esetén 1 vagy 0, különben a mért. */
  value: number;
  override?: CoverageOverride;
}

export type Coverage = Record<Pillar, PillarCoverage>;

const PILLARS: Pillar[] = ['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'];

export interface CoverageInput {
  answers: ChecklistAnswers;
  profile: CaseProfile;
  kind: EngagementKind;
  requestStatus: Record<string, RequestStatus>;
  extraRequests?: DocRequest[];
  overrides?: CoverageOverrides;
}

const answered = (v: unknown) => v !== undefined && v !== null && v !== '';

export function computeCoverage(input: CoverageInput): Coverage {
  const sectors = input.profile.sectors;
  const docs = [...buildRequestList(input.profile, input.kind), ...(input.extraRequests ?? [])];
  const out = {} as Coverage;
  for (const pillar of PILLARS) {
    const qs = CHECKLIST.filter((q) => q.pillar === pillar && isVisible(q, input.answers, sectors));
    const questions = { answered: qs.filter((q) => answered(input.answers[q.id])).length, total: qs.length };
    // Kötelező iratok; a „nem releváns” jelölésű nem számít a nevezőbe.
    const required = docs.filter((d) => d.pillar === pillar && d.priority === 'REQUIRED' && input.requestStatus[d.id] !== 'NA');
    const documents = { received: required.filter((d) => input.requestStatus[d.id] === 'RECEIVED').length, total: required.length };
    const parts = [questions, documents].filter((p) => p.total > 0).map((p) => ('answered' in p ? p.answered : p.received) / p.total);
    const measured = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    const override = input.overrides?.[pillar];
    out[pillar] = {
      pillar,
      questions,
      documents,
      measured,
      value: override ? (override.state === 'EXAMINED' ? 1 : 0) : measured,
      ...(override ? { override } : {}),
    };
  }
  return out;
}

/**
 * A projekt lefedettsége a mentett adatgyűjtésből (kérdőív, iratbekérés) és a
 * munkaterület felülbírálásaiból. A felület minden értékelő nézete ezt adja
 * át a motornak, hogy a mátrix, a Projekt oldal és a riport ugyanazt mutassa.
 */
export function projectCoverage(projectId: string, kind: EngagementKind, overrides?: CoverageOverrides, extraSectors: Sector[] = []): Coverage {
  const intake = loadIntake(projectId);
  const sectors = [...new Set([...intake.profile.sectors, ...extraSectors])];
  return computeCoverage({
    answers: intake.answers,
    profile: { ...intake.profile, sectors },
    kind,
    requestStatus: intake.requestStatus,
    extraRequests: intake.extraRequests,
    overrides,
  });
}

/** A motornak átadható pillérenkénti érték (0–1). */
export function coverageValues(c: Coverage): Record<Pillar, number> {
  return Object.fromEntries(PILLARS.map((p) => [p, c[p].value])) as Record<Pillar, number>;
}

/**
 * Felülbírálás beállítása vagy visszavonása (null = vissza az automatikusra).
 * Indoklás nélkül nem lehet; a napló bejegyzést kap.
 */
export function setCoverageOverride(
  overrides: CoverageOverrides,
  log: CoverageLogEntry[],
  pillar: Pillar,
  state: CoverageState | null,
  reason: string,
  by: string | null,
  at = new Date().toISOString(),
): { overrides: CoverageOverrides; log: CoverageLogEntry[] } {
  const why = reason.trim();
  if (!why) throw new Error('A lefedettség felülbírálásához indoklás kell.');
  const prev = overrides[pillar]?.state ?? 'AUTO';
  const next = state ?? 'AUTO';
  if (prev === next) return { overrides, log };
  const copy = { ...overrides };
  if (state) copy[pillar] = { state, reason: why, by, at };
  else delete copy[pillar];
  return { overrides: copy, log: [...log, { pillar, from: prev, to: next, reason: why, by, at }] };
}

export const COVERAGE_STATE_LABEL: Record<CoverageState | 'AUTO', string> = {
  EXAMINED: 'vizsgáltnak jelölve',
  NOT_EXAMINED: 'nem vizsgáltnak jelölve',
  AUTO: 'automatikus (kérdőív + iratok)',
};
