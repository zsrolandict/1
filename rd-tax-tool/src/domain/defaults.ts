/** Blank and demo assessments. */
import { TAX_RATES } from './constants';
import type { Assessment, SoftwareAssetInputs, SoftwareComponent } from './types';

const isoDaysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

let idCounter = 0;
/** Stable-enough id for list keys; persisted with the component. */
export const newId = (): string => `c${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const newComponent = (kind: SoftwareComponent['kind']): SoftwareComponent => ({
  id: newId(),
  kind,
  name: kind === 'ORIGINAL' ? 'Eredeti fejlesztés' : '',
  capitalizedOn: '',
  reportedOn: '',
  capitalizedValue: 0,
  ownCosts: 0,
  relatedPartyCosts: 0,
  acquisitionCosts: 0,
});

export const emptySoftware = (): SoftwareAssetInputs => ({
  enabled: false,
  name: '',
  revenueModel: 'LICENSE',
  saasLicenceSeparated: false,
  components: [newComponent('ORIGINAL')],
  royaltyYears: [],
  hipaRoyaltyDeduction: true,
  saleDate: '',
  salePrice: 0,
  saleBookValue: 0,
  applyNexusToSaleGain: true,
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
    citDeductionTiming: 'IMMEDIATE',
    amortizationYears: 3,
  },
  audit: {
    ratings: { NOVELTY: 2, CREATIVITY: 2, UNCERTAINTY: 2, SYSTEMATIC: 2, TRANSFERABILITY: 2 },
    redFlags: {},
    notes: '',
  },
  software: emptySoftware(),
  seal: null,
  sealHistory: [],
  sealedSource: null,
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
    citDeductionTiming: 'IMMEDIATE',
    amortizationYears: 3,
  },
  audit: {
    ratings: { NOVELTY: 3, CREATIVITY: 3, UNCERTAINTY: 4, SYSTEMATIC: 2, TRANSFERABILITY: 3 },
    redFlags: { NO_TIME_TRACKING: true },
    notes: '',
  },
  // Licensed machine-vision software: original version notified on time, a
  // later enhancement still inside its 75-day window.
  software: {
    ...emptySoftware(),
    enabled: true,
    name: 'Gépi látás vezérlőszoftver',
    components: [
      {
        ...newComponent('ORIGINAL'),
        id: 'demo-original',
        name: 'v1.0 – eredeti fejlesztés',
        capitalizedOn: isoDaysAgo(500),
        reportedOn: isoDaysAgo(460),
        capitalizedValue: 120_000_000,
        ownCosts: 100_000_000,
        relatedPartyCosts: 30_000_000,
        acquisitionCosts: 40_000_000,
      },
      {
        ...newComponent('ENHANCEMENT'),
        id: 'demo-v2',
        name: 'v2.0 – mélytanulásos felismerés',
        capitalizedOn: isoDaysAgo(40),
        capitalizedValue: 45_000_000,
        ownCosts: 45_000_000,
      },
    ],
    royaltyYears: [
      { year: new Date().getFullYear() - 1, royaltyIncome: 40_000_000, relatedCosts: 10_000_000, profitBeforeTax: 310_000_000 },
    ],
  },
  seal: null,
  sealHistory: [],
  sealedSource: null,
});
