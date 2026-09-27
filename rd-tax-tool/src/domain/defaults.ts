/** Blank and demo assessments. */
import { TAX_RATES } from './constants';
import type { Assessment } from './types';

export const emptyAssessment = (): Assessment => ({
  client: {
    companyName: '',
    taxNumber: '',
    industry: 'MACHINERY_AUTOMATION',
    projectName: '',
    taxYear: new Date().getFullYear() - 1,
    annualRevenue: 0,
    profitBeforeTax: 0,
    companySize: 'MICRO_SMALL',
    advisorName: '',
  },
  costs: {
    engineerGrossWages: 0,
    phdGrossWages: 0,
    phdHeadcount: 0,
    doctoralGrossWages: 0,
    doctoralHeadcount: 0,
    researcherMonths: 12,
    materialCosts: 0,
    prototypeCosts: 0,
    subcontractorCosts: 0,
  },
  params: {
    engineerRelief: 'CIT',
    hipaRate: TAX_RATES.HIPA_DEFAULT,
    includeEmployerContribution: false,
    selfRevisionYears: 0,
  },
  audit: {
    ratings: { NOVELTY: 2, CREATIVITY: 2, UNCERTAINTY: 2, SYSTEMATIC: 2, TRANSFERABILITY: 2 },
    redFlags: {},
    notes: '',
  },
  seal: null,
  sealHistory: [],
});

/** Fictitious mid-size machinery client used for demos and training. */
export const demoAssessment = (): Assessment => ({
  client: {
    companyName: 'Példa Gépgyártó Zrt.',
    taxNumber: '12345678-2-13',
    industry: 'MACHINERY_AUTOMATION',
    projectName: 'Adaptív robotcella-vezérlés gépi látással',
    taxYear: new Date().getFullYear() - 1,
    annualRevenue: 4_800_000_000,
    profitBeforeTax: 310_000_000,
    companySize: 'LARGE',
    advisorName: '',
  },
  costs: {
    engineerGrossWages: 96_000_000,
    phdGrossWages: 18_000_000,
    phdHeadcount: 3,
    doctoralGrossWages: 4_800_000,
    doctoralHeadcount: 2,
    researcherMonths: 12,
    materialCosts: 22_000_000,
    prototypeCosts: 35_000_000,
    subcontractorCosts: 14_000_000,
  },
  params: {
    engineerRelief: 'CIT',
    hipaRate: 0.02,
    includeEmployerContribution: false,
    selfRevisionYears: 2,
  },
  audit: {
    ratings: { NOVELTY: 3, CREATIVITY: 3, UNCERTAINTY: 4, SYSTEMATIC: 2, TRANSFERABILITY: 3 },
    redFlags: { NO_TIME_TRACKING: true },
    notes: '',
  },
  seal: null,
  sealHistory: [],
});
