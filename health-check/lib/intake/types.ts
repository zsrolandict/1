import type { KnownFact } from '@/lib/interview/types';
import type { Pillar, Scale5 } from '@/lib/risk/types';
import type { CompanyProfile } from '@/lib/risk/valuation';

/**
 * Adatgyűjtés → Red Flag mátrix. A kérdőív, a táblázatok és a dokumentumok
 * ugyanilyen javaslatokat adnak; a mátrixba csak a szakértő elfogadása után
 * kerülnek (lásd apply.ts).
 */
export type IntakeOrigin = 'CHECKLIST' | 'DATA_TABLE' | 'AI_DOCUMENT';

export const ORIGIN_LABEL: Record<IntakeOrigin, string> = {
  CHECKLIST: 'Kérdőív',
  DATA_TABLE: 'Adattábla',
  AI_DOCUMENT: 'AI · dokumentum',
};

/** Tényadatból pontosított képlet-paraméter. */
export type ValuationPatch =
  | { type: 'REVENUE_SHARE'; share: number }
  | { type: 'PER_ITEM'; count: number };

export interface IntakeSuggestion {
  /** Stabil azonosító; ha a javaslat tartalma változik, a kulcs is változik. */
  key: string;
  origin: IntakeOrigin;
  /** Katalógus / típus / szektor tétel kódja; null = új, egyedi tétel. */
  code: string | null;
  pillar: Pillar;
  title: string;
  /** Miért javasoljuk (szabály, mutató, AI-indoklás). */
  rationale: string;
  /** Forrás-hivatkozás a mátrixba és a riportba. */
  evidence: string;
  likelihood: Scale5;
  impact: Scale5;
  valuationPatch?: ValuationPatch;
  /** Csak ha a forrásban konkrét összeg szerepel. Emelheti, de nem csökkenti a kitettséget. */
  exposureHufEstimate?: number | null;
  /** 0–1, csak AI-javaslatnál. */
  confidence?: number;
}

/** Cégadat (képletek bemenete) pontosítása tényadatból. */
export interface CompanySuggestion {
  key: string;
  origin: IntakeOrigin;
  field: keyof CompanyProfile;
  value: number;
  label: string;
  evidence: string;
}

export interface IntakeResult {
  suggestions: IntakeSuggestion[];
  companySuggestions: CompanySuggestion[];
  /** Az interjúk ellentmondás-kereséséhez átadott tények. */
  facts: KnownFact[];
}

export const EMPTY_RESULT: IntakeResult = { suggestions: [], companySuggestions: [], facts: [] };
