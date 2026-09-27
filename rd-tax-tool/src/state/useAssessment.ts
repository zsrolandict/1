/**
 * Assessment state: a single reducer holding the whole case file, autosaved
 * to the advisor's browser so a refresh never loses work. Derived results
 * (savings, audit score, action plan) are computed, never stored.
 *
 * A sealed case is read-only: every edit action is ignored until the advisor
 * reopens it as a new version, which archives the seal in `sealHistory`.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { buildActionPlan } from '../domain/actionPlan';
import { demoAssessment, emptyAssessment } from '../domain/defaults';
import { calculateSavings } from '../domain/engine';
import { scoreAudit } from '../domain/scoring';
import { createSeal, verifySeal } from '../domain/seal';
import type {
  Assessment,
  AuditAnswers,
  AuditSeal,
  ClientProfile,
  CompanySize,
  RdCostInputs,
  TaxParameters,
} from '../domain/types';

const STORAGE_KEY = 'ict-rd-assessment-v1';

type Action =
  | { type: 'client'; patch: Partial<ClientProfile> }
  | { type: 'costs'; patch: Partial<RdCostInputs> }
  | { type: 'params'; patch: Partial<TaxParameters> }
  | { type: 'audit'; patch: Partial<AuditAnswers> }
  | { type: 'seal'; seal: AuditSeal }
  | { type: 'reopen' }
  | { type: 'replace'; assessment: Assessment };

function reducer(state: Assessment, action: Action): Assessment {
  // Sealed cases only accept replace (new/open/demo) and reopen.
  if (state.seal && action.type !== 'replace' && action.type !== 'reopen') return state;

  switch (action.type) {
    case 'client':
      return { ...state, client: { ...state.client, ...action.patch } };
    case 'costs':
      return { ...state, costs: { ...state.costs, ...action.patch } };
    case 'params':
      return { ...state, params: { ...state.params, ...action.patch } };
    case 'audit':
      return { ...state, audit: { ...state.audit, ...action.patch } };
    case 'seal':
      return { ...state, seal: action.seal };
    case 'reopen':
      return state.seal ? { ...state, seal: null, sealHistory: [...state.sealHistory, state.seal] } : state;
    case 'replace':
      return action.assessment;
  }
}

/** Company sizes saved by v1.0 files. */
const LEGACY_SIZES: Record<string, CompanySize> = { SME: 'MICRO_SMALL', LIABLE: 'LARGE' };

/**
 * Merges an untrusted object (localStorage or an imported file) onto a blank
 * assessment so missing or extra keys from older versions cannot break the UI.
 */
export function normaliseAssessment(raw: unknown): Assessment {
  const base = emptyAssessment();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Partial<Assessment>;
  const client = { ...base.client, ...(r.client ?? {}) };
  client.companySize = LEGACY_SIZES[client.companySize] ?? client.companySize;
  return {
    client,
    costs: { ...base.costs, ...(r.costs ?? {}) },
    params: { ...base.params, ...(r.params ?? {}) },
    audit: {
      ratings: { ...base.audit.ratings, ...(r.audit?.ratings ?? {}) },
      redFlags: { ...(r.audit?.redFlags ?? {}) },
      notes: typeof r.audit?.notes === 'string' ? r.audit.notes : '',
    },
    seal: r.seal && typeof r.seal.hash === 'string' ? r.seal : null,
    sealHistory: Array.isArray(r.sealHistory) ? r.sealHistory : [],
  };
}

function loadInitial(): Assessment {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normaliseAssessment(JSON.parse(stored));
  } catch {
    // Storage unavailable or corrupt – start blank.
  }
  return emptyAssessment();
}

/** 'none' = not sealed; 'valid' / 'invalid' = result of re-hashing the data. */
export type SealStatus = 'none' | 'checking' | 'valid' | 'invalid';

export function useAssessment() {
  const [assessment, dispatch] = useReducer(reducer, undefined, loadInitial);
  const [sealStatus, setSealStatus] = useState<SealStatus>('none');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
    } catch {
      // Autosave is a convenience; ignore quota / privacy-mode errors.
    }
  }, [assessment]);

  // Re-verify whenever the sealed data could have changed (load, import, seal).
  useEffect(() => {
    if (!assessment.seal) {
      setSealStatus('none');
      return;
    }
    let cancelled = false;
    setSealStatus('checking');
    verifySeal(assessment)
      .then((ok) => !cancelled && setSealStatus(ok ? 'valid' : 'invalid'))
      .catch(() => !cancelled && setSealStatus('invalid'));
    return () => {
      cancelled = true;
    };
  }, [assessment]);

  const savings = useMemo(
    () => calculateSavings(assessment.client, assessment.costs, assessment.params),
    [assessment.client, assessment.costs, assessment.params],
  );
  const audit = useMemo(
    () => scoreAudit(assessment.audit, assessment.client.industry),
    [assessment.audit, assessment.client.industry],
  );
  const actionPlan = useMemo(
    () => buildActionPlan(audit, assessment.audit, savings, assessment.params.selfRevisionYears),
    [audit, assessment.audit, savings, assessment.params.selfRevisionYears],
  );

  const actions = useMemo(
    () => ({
      updateClient: (patch: Partial<ClientProfile>) => dispatch({ type: 'client', patch }),
      updateCosts: (patch: Partial<RdCostInputs>) => dispatch({ type: 'costs', patch }),
      updateParams: (patch: Partial<TaxParameters>) => dispatch({ type: 'params', patch }),
      updateAudit: (patch: Partial<AuditAnswers>) => dispatch({ type: 'audit', patch }),
      reopen: () => dispatch({ type: 'reopen' }),
      reset: () => dispatch({ type: 'replace', assessment: emptyAssessment() }),
      loadDemo: () => dispatch({ type: 'replace', assessment: demoAssessment() }),
      load: (raw: unknown) => dispatch({ type: 'replace', assessment: normaliseAssessment(raw) }),
    }),
    [],
  );

  /** Seals the current data; the advisor name is recorded in the seal. */
  const seal = useCallback(
    async (sealedBy: string) => {
      if (assessment.seal) return;
      dispatch({ type: 'seal', seal: await createSeal(assessment, sealedBy) });
    },
    [assessment],
  );

  /** Downloads the case file as JSON so it can be archived with the engagement. */
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(assessment, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (assessment.client.companyName || 'ugyfel')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    a.href = url;
    a.download = `kf-diagnosztika-${slug}-${assessment.client.taxYear}${assessment.seal ? '-lezart' : ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assessment]);

  return { assessment, savings, audit, actionPlan, sealStatus, seal, exportJson, ...actions };
}
