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

const omit = <T extends object>(obj: T, keys: readonly string[]): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k))) as Partial<T>;

/**
 * The exact byte string that is hashed: case data + seal metadata. The data
 * shape follows the engine version stored in the seal: fields added later
 * (and back-filled with defaults on load) are left out, so older seals keep
 * verifying.
 */
function sealPayload(assessment: Assessment, meta: SealMeta): string {
  const { client, costs, params, audit, ip, sealHistory } = assessment;
  if (meta.engineVersion === '2026.2') {
    const data = {
      client,
      costs: omit(costs, ['grantFundedCosts', 'universityJointCosts']),
      params: omit(params, ['hipaMaterialAlreadyDeducted', 'hipaSubcontractorAlreadyDeducted']),
      audit,
      sealHistory,
    };
    return canonicalJson({ data, seal: meta });
  }
  return canonicalJson({ data: { client, costs, params, audit, ip, sealHistory }, seal: meta });
}

export async function createSeal(assessment: Assessment, sealedBy: string, now = new Date()): Promise<AuditSeal> {
  const meta: SealMeta = {
    algorithm: 'SHA-256',
    sealedAt: now.toISOString(),
    sealedBy: sealedBy.trim(),
    engineVersion: ENGINE_VERSION,
  };
  return { ...meta, hash: await sha256Hex(sealPayload(assessment, meta)) };
}

/** True when the stored hash still matches the case data. */
export async function verifySeal(assessment: Assessment): Promise<boolean> {
  const { seal } = assessment;
  if (!seal) return false;
  const { hash, ...meta } = seal;
  return (await sha256Hex(sealPayload(assessment, meta))) === hash;
}

/** 4f8a…9c21 */
export const shortHash = (hash: string): string => `${hash.slice(0, 8)}…${hash.slice(-8)}`;

/** 2026. 09. 27. 13:30:00 (local) for display. */
export const formatSealTime = (iso: string): string =>
  new Date(iso).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'medium' });
