/** Blank and demo assessments. */
import { TAX_RATES } from './constants';
import type { Assessment, IpBoxInputs } from './types';

const isoDaysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const emptyIpBox = (): IpBoxInputs => ({
  enabled: false,
  assetType: 'SOFTWARE',
  assetName: '',
  royaltyIncome: 0,
  royaltyRelatedCosts: 0,
  nexusOwnCosts: 0,
  nexusRelatedPartyCosts: 0,
  nexusAcquisitionCosts: 0,
  acquiredOn: '',
  reportedOn: '',
  plannedSaleGain: 0,
  plannedSaleDate: '',
  hipaRoyaltyReliefShare: 0,
});

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
    grantFundedCosts: 0,
    universityJointCosts: 0,
  },
  params: {
    engineerRelief: 'CIT',
    hipaRate: TAX_RATES.HIPA_DEFAULT,
    includeEmployerContribution: false,
    selfRevisionYears: 0,
    hipaMaterialAlreadyDeducted: true,
    hipaSubcontractorAlreadyDeducted: false,
  },
  audit: {
    ratings: { NOVELTY: 2, CREATIVITY: 2, UNCERTAINTY: 2, SYSTEMATIC: 2, TRANSFERABILITY: 2 },
    redFlags: {},
    notes: '',
  },
  ip: emptyIpBox(),
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
    grantFundedCosts: 0,
    universityJointCosts: 10_000_000,
  },
  params: {
    engineerRelief: 'CIT',
    hipaRate: 0.02,
    includeEmployerContribution: false,
    selfRevisionYears: 2,
    hipaMaterialAlreadyDeducted: true,
    hipaSubcontractorAlreadyDeducted: false,
  },
  audit: {
    ratings: { NOVELTY: 3, CREATIVITY: 3, UNCERTAINTY: 4, SYSTEMATIC: 2, TRANSFERABILITY: 3 },
    redFlags: { NO_TIME_TRACKING: true },
    notes: '',
  },
  // Licensed machine-vision software; created 40 days ago and not yet notified to NAV.
  ip: {
    ...emptyIpBox(),
    enabled: true,
    assetName: 'Gépi látás vezérlőszoftver',
    royaltyIncome: 40_000_000,
    royaltyRelatedCosts: 10_000_000,
    nexusOwnCosts: 100_000_000,
    nexusRelatedPartyCosts: 30_000_000,
    nexusAcquisitionCosts: 40_000_000,
    acquiredOn: isoDaysAgo(40),
  },
  seal: null,
  sealHistory: [],
});
