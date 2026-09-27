/**
 * Tamper-evident sealing of a case file with SHA-256 (Web Crypto API).
 *
 * The hash covers the canonical JSON of every input (client, costs,
 * parameters, audit answers, earlier seals) plus the seal metadata. Any later
 * edit of the saved file therefore makes `verifySeal` fail.
 *
 * Limits: the timestamp is the advisor's device clock and the hash proves
 * integrity, not time. A qualified (eIDAS) timestamp needs a trust service.
 */
import { ENGINE_VERSION } from './constants';
import type { Assessment, AuditSeal } from './types';

/**
 * Deterministic JSON: object keys sorted at every depth, so the same data
 * always yields the same bytes regardless of key order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    // Non-finite numbers are not valid JSON; normalise them explicitly.
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

type SealMeta = Omit<AuditSeal, 'hash'>;

/**
 * Which top-level fields each engine version hashed. When fields are added
 * or renamed, older seals are verified against `sealedSource` (the data as it
 * was in the file) using that version's field list.
 */
const SEALED_FIELDS: Record<string, readonly string[]> = {
  '2026.2': ['client', 'costs', 'params', 'audit', 'sealHistory'],
  '2026.3': ['client', 'costs', 'params', 'audit', 'ip', 'sealHistory'],
};
const CURRENT_FIELDS = ['client', 'costs', 'params', 'audit', 'software', 'sealHistory'] as const;

export const isLegacySealVersion = (version: string): boolean => version in SEALED_FIELDS;

const pick = (source: Record<string, unknown>, fields: readonly string[]) =>
  Object.fromEntries(fields.map((f) => [f, source[f]]));

/** The exact byte string that is hashed: case data + seal metadata. */
function sealPayload(source: Record<string, unknown>, meta: SealMeta): string {
  const fields = SEALED_FIELDS[meta.engineVersion] ?? CURRENT_FIELDS;
  return canonicalJson({ data: pick(source, fields), seal: meta });
}

const asRecord = (a: Assessment): Record<string, unknown> => a as unknown as Record<string, unknown>;

export async function createSeal(assessment: Assessment, sealedBy: string, now = new Date()): Promise<AuditSeal> {
  const meta: SealMeta = {
    algorithm: 'SHA-256',
    sealedAt: now.toISOString(),
    sealedBy: sealedBy.trim(),
    engineVersion: ENGINE_VERSION,
  };
  return { ...meta, hash: await sha256Hex(sealPayload(asRecord(assessment), meta)) };
}

/** True when the stored hash still matches the case data. */
export async function verifySeal(assessment: Assessment): Promise<boolean> {
  const { seal } = assessment;
  if (!seal) return false;
  const { hash, ...meta } = seal;
  // Legacy seals are checked against the file content they were computed on.
  const source = isLegacySealVersion(meta.engineVersion) ? assessment.sealedSource : asRecord(assessment);
  if (!source) return false;
  return (await sha256Hex(sealPayload(source, meta))) === hash;
}

/** 4f8a…9c21 */
export const shortHash = (hash: string): string => `${hash.slice(0, 8)}…${hash.slice(-8)}`;

/** 2026. 09. 27. 13:30:00 (local) for display. */
export const formatSealTime = (iso: string): string =>
  new Date(iso).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'medium' });
