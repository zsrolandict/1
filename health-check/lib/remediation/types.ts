import type { Role } from '@/lib/timesheet/timesheet';
import type { Division } from '@/lib/risk/types';

/** Egy munkalépés a javítási tervben. Óra = `hours` + `perUnit` × terjedelem. */
export interface StepTemplate {
  label: string;
  /** Mit csinálunk és mi az eredménye (egy-két mondat). */
  detail: string;
  role: Role;
  hours: number;
  /** Terjedelmi egységenkénti további óra (pl. szerződésenként). */
  perUnit?: number;
  /** Ha a lépést másik üzletág végzi, mint a tétel gazdája. */
  division?: Division;
}

export interface PlanTemplate {
  /** A javítás célja, átadandó eredménye. */
  goal: string;
  steps: StepTemplate[];
  /** A terjedelmet meghatározó tényező (pl. érintett szerződések száma). */
  driver?: {
    label: string;
    unit: string;
    default: number;
    /** A kitettség darabszám-alapú képletéből veszi (ha van). */
    fromValuation?: boolean;
  };
  /** A becslés sávja a várható érték szorzójaként [alsó, felső]. */
  spread: [number, number];
  /** Mitől függ, hogy a sáv melyik végére kerül. */
  uncertainty: string;
  /** Az ügyfél saját ráfordítása (nem része a díjnak). */
  client: { days: number; who: string };
  /** Külső költségek, amelyek nem részei a díjnak. */
  external: string[];
  /** Feltételezések, amelyekre a becslés épül. */
  assumptions: string[];
}

/** Tételenkénti szakértői pontosítás. */
export interface PlanOverride {
  /** A terjedelem tényleges értéke (pl. 12 szerződés). */
  driver?: number | null;
  /** Lépésenkénti óraszám-felülírás (kulcs: a lépés sorszáma, 0-tól). */
  hours?: Record<string, number>;
  /** Kézi díj (Ft): ha meg van adva, ez az érvényes, a terv csak tájékoztat. */
  feeOverrideHuf?: number | null;
  /** Miért tér el a sablontól. */
  note?: string;
}

export type FeeSource = 'TEMPLATE' | 'GENERIC' | 'MANUAL';

export interface EstimatedStep {
  index: number;
  label: string;
  detail: string;
  role: Role;
  division: Division;
  hours: number;
  /** A sablon alapórája és egységenkénti órája (a képlethez). */
  baseHours: number;
  perUnit: number;
  rate: number;
  feeHuf: number;
  /** Az órát a szakértő írta át. */
  overridden: boolean;
  /** Képlet szövegesen: alapóra + egységenkénti óra × terjedelem. */
  hoursFormula: string;
}

export interface RemediationEstimate {
  source: FeeSource;
  goal: string;
  steps: EstimatedStep[];
  driver: { label: string; unit: string; value: number; origin: 'ITEM' | 'VALUATION' | 'TEMPLATE' } | null;
  hours: number;
  /** Az érvényes díj: alsó, várható, felső (Ft). */
  fee: { low: number; base: number; high: number };
  /** A terv szerinti díj (kézi díjnál is látszik, összevetéshez). */
  planFeeHuf: number;
  spread: [number, number];
  uncertainty: string;
  client: { days: number; who: string };
  external: string[];
  assumptions: string[];
  /** Díj üzletágankénti bontásban (a várható értékből). */
  byDivision: Partial<Record<Division, number>>;
  unapprovedRates: boolean;
  note?: string;
}
