/**
 * Assessment state: a single reducer holding the whole case file, autosaved
 * to the advisor's browser so a refresh never loses work. Derived results
 * (savings, audit score, action plan) are computed, never stored.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { buildActionPlan } from '../domain/actionPlan';
import { demoAssessment, emptyAssessment } from '../domain/defaults';
import { calculateSavings } from '../domain/engine';
import { scoreAudit } from '../domain/scoring';
import type {
  Assessment,
  AuditAnswers,
  ClientProfile,
  RdCostInputs,
  TaxParameters,
} from '../domain/types';

const STORAGE_KEY = 'ict-rd-assessment-v1';

type Action =
  | { type: 'client'; patch: Partial<ClientProfile> }
  | { type: 'costs'; patch: Partial<RdCostInputs> }
  | { type: 'params'; patch: Partial<TaxParameters> }
  | { type: 'audit'; patch: Partial<AuditAnswers> }
  | { type: 'replace'; assessment: Assessment };

function reducer(state: Assessment, action: Action): Assessment {
  switch (action.type) {
    case 'client':
      return { ...state, client: { ...state.client, ...action.patch } };
    case 'costs':
      return { ...state, costs: { ...state.costs, ...action.patch } };
    case 'params':
      return { ...state, params: { ...state.params, ...action.patch } };
    case 'audit':
      return { ...state, audit: { ...state.audit, ...action.patch } };
    case 'replace':
      return action.assessment;
  }
}

/**
 * Merges an untrusted object (localStorage or an imported file) onto a blank
 * assessment so missing or extra keys from older versions cannot break the UI.
 */
export function normaliseAssessment(raw: unknown): Assessment {
  const base = emptyAssessment();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Partial<Assessment>;
  return {
    client: { ...base.client, ...(r.client ?? {}) },
    costs: { ...base.costs, ...(r.costs ?? {}) },
    params: { ...base.params, ...(r.params ?? {}) },
    audit: {
      ratings: { ...base.audit.ratings, ...(r.audit?.ratings ?? {}) },
      redFlags: { ...base.audit.redFlags, ...(r.audit?.redFlags ?? {}) },
      notes: typeof r.audit?.notes === 'string' ? r.audit.notes : '',
    },
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

export function useAssessment() {
  const [assessment, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
    } catch {
      // Autosave is a convenience; ignore quota / privacy-mode errors.
    }
  }, [assessment]);

  const savings = useMemo(
    () => calculateSavings(assessment.client, assessment.costs, assessment.params),
    [assessment.client, assessment.costs, assessment.params],
  );
  const audit = useMemo(() => scoreAudit(assessment.audit), [assessment.audit]);
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
      reset: () => dispatch({ type: 'replace', assessment: emptyAssessment() }),
      loadDemo: () => dispatch({ type: 'replace', assessment: demoAssessment() }),
      load: (raw: unknown) => dispatch({ type: 'replace', assessment: normaliseAssessment(raw) }),
    }),
    [],
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
      .toLowerCase();
    a.href = url;
    a.download = `kf-diagnosztika-${slug}-${assessment.client.taxYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assessment]);

  return { assessment, savings, audit, actionPlan, exportJson, ...actions };
}
