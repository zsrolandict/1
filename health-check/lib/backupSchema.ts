import { z } from 'zod';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';

/**
 * A projektmentés (JSON) szerkezetének ellenőrzése visszatöltéskor. Kézzel
 * szerkesztett vagy sérült fájl ne kerülhessen a tárolóba, mert a képernyők
 * betöltéskor elszállnának rajta. Az ismeretlen, újabb mezőket megtartjuk
 * (passthrough), hogy egy későbbi verzió mentése se veszítsen adatot.
 */
const Scale = z.number().int().min(1).max(5);
export const MoneySchema = z.number().finite().nonnegative();
const Money = MoneySchema;

/**
 * Egy kockázati tétel szerkezete. Ugyanezt használja a fájlból visszatöltés és
 * a böngészős tárolóból betöltés (`lib/risk/store.ts`), hogy a két út ne térjen el.
 */
export const ItemSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    pillar: z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']),
    title: z.string(),
    description: z.string().default(''),
    identified: z.boolean(),
    likelihood: Scale,
    impact: Scale,
    exposureHuf: Money,
    remediationDays: z.number().finite().nonnegative(),
    remediation: z.string().default(''),
    division: z.enum(['LEGAL', 'TAX', 'ACCOUNTING', 'HR', 'ADVISORY']),
    serviceFeeHuf: Money,
  })
  .passthrough();

const PillarEnum = z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']);
const CoverageState = z.enum(['EXAMINED', 'NOT_EXAMINED']);

/** Lefedettség szakértői felülbírálása pillérenként (indoklás kötelező). */
export const CoverageOverridesSchema = z.partialRecord(
  PillarEnum,
  z.object({ state: CoverageState, reason: z.string().trim().min(1).max(2000), by: z.string().max(200).nullable(), at: z.string().max(40) }),
);

/** Lefedettségi napló. */
export const CoverageLogSchema = z
  .array(
    z.object({
      pillar: PillarEnum,
      from: z.union([CoverageState, z.literal('AUTO')]),
      to: z.union([CoverageState, z.literal('AUTO')]),
      reason: z.string().max(2000),
      by: z.string().max(200).nullable(),
      at: z.string().max(40),
    }),
  )
  .max(500);

export const CompanySchema = z.object({
  revenueHuf: Money,
  grossMarginPct: z.number().min(0).max(1),
  actualDsoDays: z.number().finite().nonnegative(),
  industryDsoDays: z.number().finite().nonnegative(),
});

export const BackupWorkspaceSchema = z
  .object({
    projectId: z.string().min(1).max(100),
    scenarioId: z.string().min(1).max(100),
    companyName: z.string().max(300),
    company: CompanySchema,
    kind: EngagementKindSchema,
    materialityHuf: Money,
    items: z.array(ItemSchema).max(2000),
  })
  .passthrough();

const ModulesSchema = z
  .object({
    intake: z.record(z.string(), z.unknown()).optional(),
    interviews: z.record(z.string(), z.unknown()).optional(),
    snapshots: z.array(z.unknown()).optional(),
    timesheet: z
      .object({ entries: z.array(z.unknown()) })
      .passthrough()
      .optional(),
  })
  .default({});

export const BackupSchema = z.object({
  format: z.literal('ict-hc-projekt'),
  version: z.literal(1),
  exportedAt: z.string(),
  meta: z.unknown().nullable().optional(),
  workspace: BackupWorkspaceSchema,
  modules: ModulesSchema,
});

/** Az első hiba emberi nyelven („workspace.items.3.likelihood: …”). */
export function describeBackupIssue(error: z.ZodError): string {
  return describeIssue(error);
}

export function describeIssue(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? `${first.path.join('.') || 'fájl'}: ${first.message}` : 'ismeretlen szerkezet';
}
