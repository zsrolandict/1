import type { EngagementKind } from '@/lib/engagement/kinds';
import type { SuggestedRedFlag } from '@/lib/interview/types';
import { catalogDefault, DEFAULT_CATALOG, PILLAR_LABEL } from './catalog';
import type { RiskItem, Scale5 } from './types';
import { DEFAULT_COMPANY, resolveExposure, type CompanyProfile } from './valuation';

/**
 * MVP munkaállapot (egy projekt) a böngészőben. Élesben ugyanez a forma
 * a Supabase `engagements` + `red_flags` sorokból áll elő; a komponensek
 * csak ezen a modulon keresztül olvasnak/írnak, így a csere egy helyen történik.
 */
export interface Workspace {
  companyName: string;
  company: CompanyProfile;
  kind: EngagementKind;
  materialityHuf: number;
  items: RiskItem[];
}

export const STORAGE_KEY = 'ict-hc:workspace:v2';
const LEGACY_KEY = 'ict-hc:red-flag-matrix:v1';

export const DEFAULT_WORKSPACE: Workspace = {
  companyName: 'Minta Gyártó Kft.',
  company: DEFAULT_COMPANY,
  kind: 'VENDOR_DD',
  materialityHuf: 50_000_000,
  items: DEFAULT_CATALOG,
};

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return DEFAULT_WORKSPACE;
    const saved = JSON.parse(raw) as Partial<Workspace>;
    return {
      companyName: typeof saved.companyName === 'string' ? saved.companyName : DEFAULT_WORKSPACE.companyName,
      company: { ...DEFAULT_COMPANY, ...(saved.company ?? {}) },
      kind: saved.kind ?? DEFAULT_WORKSPACE.kind,
      materialityHuf: typeof saved.materialityHuf === 'number' ? saved.materialityHuf : DEFAULT_WORKSPACE.materialityHuf,
      items: Array.isArray(saved.items) ? saved.items.map(hydrateItem) : DEFAULT_WORKSPACE.items,
    };
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

/**
 * Korábbi verzióban mentett tétel kiegészítése a katalógus újabb mezőivel
 * (indoklás, képlet). A felhasználó által már kitöltött értéket nem írjuk felül.
 */
export function hydrateItem(item: RiskItem): RiskItem {
  const def = catalogDefault(item.code);
  if (!def) return item;
  let valuation = item.valuation ?? def.valuation;
  // Ha a korábbi verzióban kézzel átírták az összeget, az szakértői felülírás marad.
  if (!item.valuation && valuation && item.exposureHuf !== def.exposureHuf) {
    valuation = { ...valuation, overrideHuf: item.exposureHuf };
  }
  return { ...item, reasoning: item.reasoning ?? def.reasoning, valuation };
}

export function saveWorkspace(ws: Workspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
  } catch {
    /* privát mód – a munkamenet végéig memóriában marad */
  }
}

const clamp5 = (n: number): Scale5 => Math.min(5, Math.max(1, Math.round(n))) as Scale5;

/**
 * Elfogadott AI-javaslat beolvasztása a kockázati listába.
 * Katalógustételnél: azonosítottá tesszük, a súlyosságot sosem csökkentjük.
 * Egyéb esetben új, egyedi tétel jön létre.
 */
export function applySuggestion(
  items: RiskItem[],
  s: SuggestedRedFlag,
  evidence: string,
  company: CompanyProfile = DEFAULT_COMPANY,
): RiskItem[] {
  const existing = s.templateCode ? items.find((r) => r.code === s.templateCode) : undefined;
  if (existing) {
    return items.map((r) =>
      r.id !== existing.id
        ? r
        : {
            ...r,
            identified: true,
            likelihood: clamp5(Math.max(r.likelihood, s.likelihood)),
            impact: clamp5(Math.max(r.impact, s.impact)),
            ...raiseExposure(r, s.exposureHufEstimate, company),
            source: 'AI_INTERVIEW',
            evidence,
          },
    );
  }
  const n = items.filter((r) => r.id.startsWith('CUS-')).length + 1;
  const code = `CUS-${String(n).padStart(2, '0')}`;
  return [
    {
      id: `${code}-${Date.now().toString(36)}`,
      code,
      pillar: s.pillar,
      title: s.title,
      description: `${PILLAR_LABEL[s.pillar]} · interjúból`,
      reasoning: s.rationale,
      identified: true,
      likelihood: clamp5(s.likelihood),
      impact: clamp5(s.impact),
      exposureHuf: s.exposureHufEstimate ?? 0,
      remediationDays: 5,
      remediation: '',
      division: 'ADVISORY',
      serviceFeeHuf: 0,
      source: 'AI_INTERVIEW',
      evidence,
    },
    ...items,
  ];
}

/** Az interjúban elhangzott összeg csak emelheti a kitettséget, csökkenteni nem. */
function raiseExposure(r: RiskItem, estimate: number | null, company: CompanyProfile): Partial<RiskItem> {
  if (estimate == null) return {};
  const current = resolveExposure(r, company).valueHuf;
  if (estimate <= current) return {};
  if (r.valuation && r.valuation.formula.type !== 'MANUAL') {
    return { valuation: { ...r.valuation, overrideHuf: estimate } };
  }
  return { exposureHuf: estimate };
}
