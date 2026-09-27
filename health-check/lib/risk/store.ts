import type { EngagementKind } from '@/lib/engagement/kinds';
import type { SuggestedRedFlag } from '@/lib/interview/types';
import { DEFAULT_CATALOG, PILLAR_LABEL } from './catalog';
import type { RiskItem, Scale5 } from './types';

/**
 * MVP munkaállapot (egy projekt) a böngészőben. Élesben ugyanez a forma
 * a Supabase `engagements` + `red_flags` sorokból áll elő; a komponensek
 * csak ezen a modulon keresztül olvasnak/írnak, így a csere egy helyen történik.
 */
export interface Workspace {
  kind: EngagementKind;
  materialityHuf: number;
  items: RiskItem[];
}

export const STORAGE_KEY = 'ict-hc:workspace:v2';
const LEGACY_KEY = 'ict-hc:red-flag-matrix:v1';

export const DEFAULT_WORKSPACE: Workspace = {
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
      kind: saved.kind ?? DEFAULT_WORKSPACE.kind,
      materialityHuf: typeof saved.materialityHuf === 'number' ? saved.materialityHuf : DEFAULT_WORKSPACE.materialityHuf,
      items: Array.isArray(saved.items) ? saved.items : DEFAULT_WORKSPACE.items,
    };
  } catch {
    return DEFAULT_WORKSPACE;
  }
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
export function applySuggestion(items: RiskItem[], s: SuggestedRedFlag, evidence: string): RiskItem[] {
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
            exposureHuf: Math.max(r.exposureHuf, s.exposureHufEstimate ?? 0),
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
      description: `${PILLAR_LABEL[s.pillar]} · interjúból: ${s.rationale}`,
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
