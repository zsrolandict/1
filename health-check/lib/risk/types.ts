import type { KindAdjustment } from '@/lib/engagement/adjustments';
import type { ChangeEntry, EvidenceEntry } from './trail';
import type { Valuation } from './valuation';

// Kockázati motor – domain típusok.
// Tiszta TypeScript: kliensen (azonnali számolás) és szerveren (PDF export,
// Supabase Edge Function) is ugyanez a kód fut, így a riport és a UI nem térhet el.

export type Pillar = 'FINANCE' | 'LEGAL' | 'OPERATIONS' | 'HR';

export type Rag = 'GREEN' | 'AMBER' | 'RED';

/** 1 = ritka / elhanyagolható … 5 = szinte biztos / kritikus */
export type Scale5 = 1 | 2 | 3 | 4 | 5;

/** ICT divíziók, amelyek felé a feltárt hiba lead-ként továbbmegy. */
export type Division = 'LEGAL' | 'TAX' | 'ACCOUNTING' | 'HR' | 'ADVISORY';

export type ActionWindow = 'D0_30' | 'D31_60' | 'D61_90' | 'BACKLOG';

export interface RiskItem {
  id: string;
  pillar: Pillar;
  code: string; // pl. "LEG-03" – a sablonkatalógus kódja
  title: string;
  description: string;
  /** A tanácsadó bepipálta: az átvilágítás során ténylegesen fennáll. */
  identified: boolean;
  likelihood: Scale5;
  impact: Scale5;
  /** Forintosított bruttó kitettség (tőkekitettség / bírság / adóhiány), Ft. */
  exposureHuf: number;
  /** Becsült javítási ráfordítás ügyfél + ICT oldalon, munkanap. */
  remediationDays: number;
  /** Javaslat szövege az akciótervbe. */
  remediation: string;
  /** Melyik ICT divízió tudja megoldani (keresztértékesítés). */
  division: Division;
  /** Becsült ICT szolgáltatási díj a remediációra, Ft (nettó). */
  serviceFeeHuf: number;
  /** Honnan származik a tétel. Hiányzik = katalógus / kézi. */
  source?: RiskSource;
  /** Bizonyíték: idézet + hivatkozás (dokumentum oldal, interjú időbélyeg). Összefűzött szöveg; a részletek a `trail`-ben. */
  evidence?: string;
  /** Bizonyíték-lánc: minden forrás külön, hellyel, idézettel, hatással, elfogadóval. */
  trail?: EvidenceEntry[];
  /** A szakértő módosításai (csökkentésnél indoklással). */
  history?: ChangeEntry[];
  /** Szakmai indoklás a riportba – a katalógusból előtöltve, szerkeszthető. */
  reasoning?: string;
  /** Forintosító képlet + szakértői felülírás. Hiányzik = kézi `exposureHuf`. */
  valuation?: Valuation;
  /** A szakértő kikapcsolta a típusfüggő korrekciót ennél a tételnél. */
  ignoreKindAdjustment?: boolean;
  /** Javítás állapota az átvilágítás után (utókövetés). Hiányzik = nyitott. */
  remediationStatus?: RemediationStatus;
}

export type RemediationStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'ACCEPTED_RISK';

export type RiskSource = 'MANUAL' | 'CHECKLIST' | 'DATA_TABLE' | 'CROSS_CHECK' | 'AI_DOCUMENT' | 'AI_INTERVIEW' | 'AI_SYNTHESIS' | 'FINANCIALS';

export interface ScoredRisk extends RiskItem {
  /** A szakértő által megadott (korrekció előtti) értékek; likelihood/impact már a korrigált. */
  baseLikelihood: Scale5;
  baseImpact: Scale5;
  /** Alkalmazott típusfüggő korrekció, ha módosított. */
  adjustment?: KindAdjustment;
  /** Honnan jön a kitettség összege (képlet / felülírás / kézi) és a levezetés. */
  exposureSource: 'FORMULA' | 'OVERRIDE' | 'MANUAL';
  exposureExplanation: string;
  score: number; // likelihood × impact, 1–25
  rag: Rag;
  /** A várható veszteség elérte a lényegességi küszöböt, ezért piros (a pontszám alapján nem lenne). */
  materialityOverride: boolean;
  probability: number; // likelihood → valószínűség (0–1)
  expectedLossHuf: number; // exposure × probability
  quickWin: boolean;
  priority: number; // rendezési kulcs az akciótervhez
  window: ActionWindow;
}

export interface PillarSummary {
  pillar: Pillar;
  identified: number;
  red: number;
  amber: number;
  green: number;
  grossExposureHuf: number;
  expectedLossHuf: number;
  /** 0–100 egészségpontszám (100 = nincs azonosított kockázat). */
  healthScore: number;
  rag: Rag;
}

export interface RiskAssessment {
  risks: ScoredRisk[]; // csak az azonosítottak, prioritás szerint
  pillars: Record<Pillar, PillarSummary>;
  totals: {
    identified: number;
    red: number;
    amber: number;
    green: number;
    grossExposureHuf: number;
    expectedLossHuf: number;
    healthScore: number;
    rag: Rag;
  };
  actionPlan: Record<ActionWindow, ScoredRisk[]>;
  pipeline: {
    byDivision: Record<Division, { count: number; feeHuf: number }>;
    totalFeeHuf: number;
    /** A befizetett audit díjból beszámítható kredit. */
    creditHuf: number;
    /** Ügyfél által fizetendő nettó, ha minden javasolt remediációt megrendel. */
    netAfterCreditHuf: number;
  };
}
