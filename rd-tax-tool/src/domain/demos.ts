/**
 * Demo library: fictitious clients for training and presentations.
 * Dates are relative to today, so notification windows and holding periods
 * behave the same whenever a demo is opened.
 */
import { demoAssessment, emptyAssessment, emptySoftware, newComponent } from './defaults';
import type { Assessment, QualificationLevel, SoftwareComponent } from './types';

const DAY_MS = 86_400_000;
const isoDaysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const daysAgo = (d: number) => isoDaysFromNow(-d);
const taxYear = () => new Date().getFullYear() - 1;

const component = (kind: SoftwareComponent['kind'], id: string, patch: Partial<SoftwareComponent>): SoftwareComponent => ({
  ...newComponent(kind),
  id,
  ...patch,
});

export type DemoGroup = 'software' | 'general';

export interface DemoDefinition {
  id: string;
  group: DemoGroup;
  title: string;
  description: string;
  /** Expected verdict, shown as a pill in the demo menu. */
  outcome: QualificationLevel;
  /** Step to open after loading. */
  startStep: 'client' | 'ip' | 'results';
  build: () => Assessment;
}

/** Software company base: small R&D payroll, software industry, good audit answers. */
function softwareBase(patch: {
  companyName: string;
  taxNumber: string;
  projectName: string;
  companySize: Assessment['client']['companySize'];
  annualRevenue: number;
  profitBeforeTax: number;
  engineerGrossWages: number;
}): Assessment {
  const a = emptyAssessment();
  a.client = {
    ...a.client,
    companyName: patch.companyName,
    taxNumber: patch.taxNumber,
    industry: 'SOFTWARE_DIGITAL',
    projectName: patch.projectName,
    annualRevenue: patch.annualRevenue,
    profitBeforeTax: patch.profitBeforeTax,
    companySize: patch.companySize,
  };
  a.costs = { ...a.costs, engineerGrossWages: patch.engineerGrossWages, subcontractorCosts: 6_000_000 };
  a.audit = {
    ratings: { NOVELTY: 3, CREATIVITY: 3, UNCERTAINTY: 3, SYSTEMATIC: 3, TRANSFERABILITY: 4 },
    redFlags: {},
    notes: '',
  };
  return a;
}

export const DEMOS: readonly DemoDefinition[] = [
  // ---------------------------------------------------------------- software
  {
    id: 'software-full',
    group: 'software',
    title: 'Szoftverház – minden feltétel teljesül',
    description: 'Licencdíj, 100% saját fejlesztés, minden bejelentés határidőben, eladás 1 év után.',
    outcome: 'FULL',
    startStep: 'ip',
    build: () => {
      const y = taxYear();
      const a = softwareBase({
        companyName: 'Példa Szoftverház Kft.',
        taxNumber: '23456789-2-41',
        projectName: 'Gyártásütemező platform',
        companySize: 'MEDIUM',
        annualRevenue: 1_200_000_000,
        profitBeforeTax: 250_000_000,
        engineerGrossWages: 60_000_000,
      });
      // Well-documented development: green SZTNH readiness as well.
      a.audit.ratings = { NOVELTY: 4, CREATIVITY: 3, UNCERTAINTY: 3, SYSTEMATIC: 4, TRANSFERABILITY: 4 };
      a.software = {
        ...emptySoftware(),
        enabled: true,
        name: 'Gyártásütemező platform',
        revenueModel: 'LICENSE',
        components: [
          component('ORIGINAL', 'full-v1', {
            name: 'v1.0 – eredeti fejlesztés',
            capitalizedOn: daysAgo(1100),
            reportedOn: daysAgo(1070),
            capitalizedValue: 150_000_000,
            ownCosts: 150_000_000,
          }),
          component('ENHANCEMENT', 'full-v2', {
            name: 'v2.0 – optimalizáló modul',
            capitalizedOn: daysAgo(400),
            reportedOn: daysAgo(380),
            capitalizedValue: 60_000_000,
            ownCosts: 60_000_000,
          }),
        ],
        royaltyYears: [
          { year: y - 2, royaltyIncome: 120_000_000, relatedCosts: 30_000_000, profitBeforeTax: 200_000_000 },
          { year: y - 1, royaltyIncome: 180_000_000, relatedCosts: 40_000_000, profitBeforeTax: 230_000_000 },
          { year: y, royaltyIncome: 220_000_000, relatedCosts: 50_000_000, profitBeforeTax: 250_000_000 },
        ],
        saleDate: isoDaysFromNow(90),
        salePrice: 900_000_000,
        saleBookValue: 120_000_000,
      };
      return a;
    },
  },
  {
    id: 'software-partial',
    group: 'software',
    title: 'Felhőszolgáltató – részben teljesül',
    description: 'Vegyes (SaaS + licenc) bevétel, vásárolt kód miatt 76%-os nexus, egy elmulasztott és egy folyamatban lévő bejelentés.',
    outcome: 'PARTIAL',
    startStep: 'ip',
    build: () => {
      const y = taxYear();
      const a = softwareBase({
        companyName: 'Példa Felhő Zrt.',
        taxNumber: '34567890-2-42',
        projectName: 'Karbantartás-előrejelző SaaS',
        companySize: 'LARGE',
        annualRevenue: 3_500_000_000,
        profitBeforeTax: 160_000_000,
        engineerGrossWages: 110_000_000,
      });
      a.software = {
        ...emptySoftware(),
        enabled: true,
        name: 'Karbantartás-előrejelző platform',
        revenueModel: 'MIXED',
        saasLicenceSeparated: true,
        components: [
          component('ORIGINAL', 'part-v1', {
            name: 'v1.0 – eredeti fejlesztés',
            capitalizedOn: daysAgo(900),
            reportedOn: daysAgo(860),
            capitalizedValue: 100_000_000,
            ownCosts: 70_000_000,
            relatedPartyCosts: 20_000_000,
            acquisitionCosts: 30_000_000,
          }),
          component('ENHANCEMENT', 'part-v2', {
            name: 'v2.0 – prediktív modell',
            capitalizedOn: daysAgo(300),
            capitalizedValue: 50_000_000,
            ownCosts: 40_000_000,
          }),
          component('ENHANCEMENT', 'part-v3', {
            name: 'v3.0 – edge-ügynök',
            capitalizedOn: daysAgo(30),
            capitalizedValue: 20_000_000,
            ownCosts: 20_000_000,
          }),
        ],
        royaltyYears: [
          { year: y - 1, royaltyIncome: 80_000_000, relatedCosts: 20_000_000, profitBeforeTax: 150_000_000 },
          { year: y, royaltyIncome: 110_000_000, relatedCosts: 30_000_000, profitBeforeTax: 160_000_000 },
        ],
        saleDate: isoDaysFromNow(200),
        salePrice: 500_000_000,
        saleBookValue: 140_000_000,
      };
      return a;
    },
  },
  {
    id: 'software-none',
    group: 'software',
    title: 'SaaS-startup – nem teljesül',
    description: 'Tiszta SaaS-előfizetés licencdíj nélkül, az eredeti fejlesztést késve jelentették be – csak a K+F-kedvezmény marad.',
    outcome: 'NONE',
    startStep: 'ip',
    build: () => {
      const y = taxYear();
      const a = softwareBase({
        companyName: 'Példa SaaS Kft.',
        taxNumber: '45678901-2-43',
        projectName: 'Online foglalási rendszer',
        companySize: 'MICRO_SMALL',
        annualRevenue: 240_000_000,
        profitBeforeTax: 60_000_000,
        engineerGrossWages: 28_000_000,
      });
      a.audit.redFlags = { DATA_MIGRATION_REPORTING: true };
      a.software = {
        ...emptySoftware(),
        enabled: true,
        name: 'Foglalási rendszer',
        revenueModel: 'SAAS',
        saasLicenceSeparated: false,
        components: [
          component('ORIGINAL', 'none-v1', {
            name: 'v1.0 – eredeti fejlesztés',
            capitalizedOn: daysAgo(600),
            reportedOn: daysAgo(520),
            capitalizedValue: 80_000_000,
            ownCosts: 80_000_000,
          }),
        ],
        royaltyYears: [{ year: y, royaltyIncome: 90_000_000, relatedCosts: 20_000_000, profitBeforeTax: 60_000_000 }],
        saleDate: isoDaysFromNow(60),
        salePrice: 300_000_000,
        saleBookValue: 70_000_000,
      };
      return a;
    },
  },
  // ----------------------------------------------------------------- general
  {
    id: 'machinery',
    group: 'general',
    title: 'Gépgyártó – K+F + szoftver, kiegészítendő',
    description: 'Teljes eset: PhD-s kutatók, egyetemi együttműködés, gépi látás szoftver folyamatban lévő bejelentéssel.',
    outcome: 'PARTIAL',
    startStep: 'client',
    build: demoAssessment,
  },
  {
    id: 'electronics',
    group: 'general',
    title: 'Szenzorgyártó – adóálló K+F',
    description: 'Jól dokumentált IoT-fejlesztés, kockázati jelzés nélkül: zöld SZTNH-készültség.',
    outcome: 'FULL',
    startStep: 'results',
    build: () => {
      const a = emptyAssessment();
      a.client = {
        ...a.client,
        companyName: 'Példa Szenzortechnika Kft.',
        taxNumber: '56789012-2-08',
        industry: 'ELECTRONICS_IOT',
        projectName: 'Önkalibráló ipari rezgésszenzor',
        annualRevenue: 2_100_000_000,
        profitBeforeTax: 180_000_000,
        companySize: 'MEDIUM',
      };
      a.costs = {
        ...a.costs,
        engineerGrossWages: 55_000_000,
        phdGrossWages: 12_000_000,
        phdHeadcount: 2,
        materialCosts: 15_000_000,
        prototypeCosts: 25_000_000,
        subcontractorCosts: 8_000_000,
      };
      a.audit = {
        ratings: { NOVELTY: 4, CREATIVITY: 4, UNCERTAINTY: 4, SYSTEMATIC: 4, TRANSFERABILITY: 3 },
        redFlags: {},
        notes: 'Teljes projektdokumentáció, kísérleti jegyzőkönyvek és projektkódos munkaidő-nyilvántartás rendelkezésre áll.',
      };
      return a;
    },
  },
  {
    id: 'food',
    group: 'general',
    title: 'Élelmiszergyártó – NAV-kockázat',
    description: 'Veszteséges év, receptvariáns és gyártás-előkészítés: piros sáv, szocho 16. § javasolt.',
    outcome: 'NONE',
    startStep: 'results',
    build: () => {
      const a = emptyAssessment();
      a.client = {
        ...a.client,
        companyName: 'Példa Élelmiszer Kft.',
        taxNumber: '67890123-2-06',
        industry: 'FOOD',
        projectName: 'Cukorcsökkentett termékcsalád',
        annualRevenue: 900_000_000,
        profitBeforeTax: -20_000_000,
        companySize: 'MICRO_SMALL',
      };
      a.costs = { ...a.costs, engineerGrossWages: 18_000_000, materialCosts: 12_000_000, prototypeCosts: 9_000_000 };
      a.params = { ...a.params, engineerRelief: 'SZOCHO_16' };
      a.audit = {
        ratings: { NOVELTY: 1, CREATIVITY: 2, UNCERTAINTY: 1, SYSTEMATIC: 1, TRANSFERABILITY: 2 },
        redFlags: { PRODUCTION_PREP: true, RECIPE_VARIANT: true },
        notes: 'A költségek nagy része a gyártósor átállításához és próbagyártáshoz kapcsolódik.',
      };
      return a;
    },
  },
];

export const findDemo = (id: string): DemoDefinition | undefined => DEMOS.find((d) => d.id === id);
