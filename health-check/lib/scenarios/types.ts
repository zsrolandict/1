import type { EngagementKind } from '@/lib/engagement/kinds';
import type { Sector } from '@/lib/intake/requests';
import type { InterviewAnalysis, IntervieweeRole, KnownFact } from '@/lib/interview/types';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import type { Pillar, RiskItem } from '@/lib/risk/types';
import type { CompanyProfile } from '@/lib/risk/valuation';

/**
 * Mintaeset: egy KITALÁLT cég teljes demó-adatcsomagja
 * (cégadatok, azonosított kockázatok, dokumentum-tények, interjú, elemzés).
 * Bemutatáshoz és tesztekhez; valós céget nem ábrázol.
 */
export interface Scenario {
  id: string;
  label: string;
  sector: string;
  /** Egy mondat: mi a helyzet és miért kérték az átvilágítást. */
  situation: string;
  companyName: string;
  /** A mintacég ágazata(i) – az ágazati kockázati katalógushoz. */
  sectors?: Sector[];
  kind: EngagementKind;
  company: CompanyProfile;
  materialityHuf: number;
  items: RiskItem[];
  /** Dokumentumokból (AI-előszűrés / szakértő) ismert tények. */
  facts: KnownFact[];
  missingDocuments: { title: string; pillar: Pillar }[];
  interview: {
    role: IntervieweeRole;
    notes: string;
    /** Előre elkészített elemzés – NEM élő AI-hívás; a felület „Minta” címkével mutatja. */
    analysis: Omit<InterviewAnalysis, 'discardedUnverified'>;
  };
}

/**
 * Kockázatlista a katalógusból: alapból egyik tétel sem azonosított, a
 * `patches` kód szerint módosít (azonosítás, súlyosság, képlet), az
 * `extra` a szektorspecifikus tételeket fűzi hozzá.
 */
export function buildItems(patches: Record<string, Partial<RiskItem>>, extra: RiskItem[] = []): RiskItem[] {
  const known = new Set(DEFAULT_CATALOG.map((r) => r.code));
  for (const code of Object.keys(patches)) {
    if (!known.has(code)) throw new Error(`Ismeretlen katalóguskód a mintaesetben: ${code}`);
  }
  const base = DEFAULT_CATALOG.map((r) => ({ ...r, identified: false, ...(patches[r.code] ?? {}) }));
  return [...extra, ...base];
}

/** Szektorspecifikus tétel rövidebb megadása. */
export function sectorItem(item: Omit<RiskItem, 'id' | 'identified' | 'description'> & { description?: string; identified?: boolean }): RiskItem {
  return { id: item.code, identified: true, description: item.description ?? '', ...item };
}
