/**
 * Statutory rates and methodology constants.
 *
 * Every number the engine uses lives here so that a change in legislation is
 * a one-line edit reviewed by the tax team, not a hunt through UI code.
 */
import type {
  CompanySize,
  CriterionRating,
  FrascatiCriterionId,
  GeneralRedFlagId,
  Industry,
  IndustryRedFlagId,
  RedFlagId,
} from './types';

/** Bump when a rule changes; stored in every seal. */
export const ENGINE_VERSION = '2026.4';

export const TAX_RATES = {
  /** Szociális hozzájárulási adó – Szocho tv. */
  SZOCHO: 0.13,
  /** Szocho tv. 15. §: PhD / scientific degree – full relief… */
  SZOCHO_RELIEF_PHD: 1.0,
  /** …on at most this much gross monthly wage per person. */
  SZOCHO_PHD_MONTHLY_CAP: 500_000,
  /** Szocho tv. 15. §: doctoral students / candidates – 50% relief… */
  SZOCHO_RELIEF_DOCTORAL: 0.5,
  /** …on at most this much gross monthly wage per person. */
  SZOCHO_DOCTORAL_MONTHLY_CAP: 200_000,
  /** Szocho tv. 16. §: R&D staff without a doctorate – 50% relief, excludes the Tao deduction of the same wages. */
  SZOCHO_RELIEF_16: 0.5,
  /** Társasági adó – Tao. tv. 19. § */
  CIT: 0.09,
  /** Default local business tax rate (statutory maximum) – Htv. 40. § */
  HIPA_DEFAULT: 0.02,
  HIPA_MAX: 0.02,
  /** Innovációs járulék – Inno. tv., base equals the HIPA base. */
  INNOVATION_CONTRIBUTION: 0.003,
  /** Tao: K+F with a higher-education institution / research institute – 3× the direct cost… */
  UNIVERSITY_MULTIPLIER: 3,
  /** …at most 50 M Ft (de minimis aid). */
  UNIVERSITY_CAP: 50_000_000,
  /** Tao: carried-forward losses may offset at most 50% of the later tax base. */
  LOSS_OFFSET_LIMIT: 0.5,
} as const;

/**
 * Software IP-box rules (jogdíj / bejelentett immateriális jószág), as
 * confirmed by the tax team in September 2026.
 */
export const IP_RULES = {
  /** Tao. tv. 7. § (1) s): 50% of the royalty profit is deductible… */
  ROYALTY_DEDUCTION_SHARE: 0.5,
  /** …capped at 50% of the pre-tax profit. */
  ROYALTY_PROFIT_CAP_SHARE: 0.5,
  /** Tao. tv. 7. § (22)–(25): cumulative nexus with the OECD 30% uplift (Tao only, not HIPA). */
  NEXUS_UPLIFT: 1.3,
  /**
   * Tao. tv. 4. § 5.: notification of a notified intangible and of each
   * capitalised value increase (továbbfejlesztés); jogvesztő, cannot be made up.
   */
  NOTIFICATION_DAYS: 75,
  /** Tao. tv. 7. § (1): minimum holding period, counted from the original acquisition. */
  MIN_HOLDING_YEARS: 1,
} as const;

export const LEGAL_REFERENCES = {
  SZOCHO: 'Szocho tv. 15–16. §',
  SZOCHO_15: 'Szocho tv. 15. §',
  SZOCHO_16: 'Szocho tv. 16. §',
  CIT: 'Tao. tv. 7. § (1) t)',
  HIPA: 'Htv. 39. §',
  INNOVATION: 'Inno. tv. 17. §',
  IP_ROYALTY: 'Tao. tv. 7. § (1) s)',
  IP_NOTIFY: 'Tao. tv. 4. § 5.',
  IP_SALE: 'Tao. tv. 7. § (1) – eladás',
  IP_HIPA: 'Htv. 39. § (1) – jogdíj',
} as const;

export const REVENUE_MODEL_LABELS = {
  LICENSE: 'Licencdíj (letölthető szoftver, SDK, dedikált példány)',
  SAAS: 'SaaS-előfizetés (felhőszolgáltatás)',
  MIXED: 'Vegyes (licenc + szolgáltatás)',
} as const;

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string; description: string }[] = [
  {
    value: 'MICRO_SMALL',
    label: 'Mikro- / kisvállalkozás',
    description: '< 50 fő és ≤ 10 M EUR árbevétel vagy mérlegfőösszeg – innovációs járulék alól mentes',
  },
  {
    value: 'MEDIUM',
    label: 'Középvállalkozás',
    description: '< 250 fő és ≤ 50 M EUR árbevétel vagy ≤ 43 M EUR mérlegfőösszeg – járulékköteles',
  },
  {
    value: 'LARGE',
    label: 'Nagyvállalat',
    description: 'A kkv-határok felett – járulékköteles',
  },
];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  MICRO_SMALL: 'Mikro- / kisvállalkozás',
  MEDIUM: 'Középvállalkozás',
  LARGE: 'Nagyvállalat',
};

/** Innovation contribution liability (Inno. tv. 17. §). */
export const isInnovationContributionLiable = (size: CompanySize): boolean => size !== 'MICRO_SMALL';

export const INDUSTRY_LABELS: Record<Industry, string> = {
  MACHINERY_AUTOMATION: 'Gépipar / Automatizálás',
  CHEMICALS_MATERIALS: 'Vegyipar / Anyagtudomány',
  FOOD: 'Élelmiszeripar',
  ELECTRONICS_IOT: 'Elektronika / IoT',
  SOFTWARE_DIGITAL: 'Szoftver / Digitális',
  OTHER: 'Egyéb',
};

// ---------------------------------------------------------------------------
// Frascati / SZTNH audit methodology
// ---------------------------------------------------------------------------

export interface CriterionDefinition {
  id: FrascatiCriterionId;
  label: string;
  englishLabel: string;
  /** Weight in the 100-point score. Weights sum to 100. */
  weight: number;
  /** The single audit question put to the client. */
  question: string;
  /** What a rating means, from 0 (not met) to 4 (fully evidenced). */
  anchors: Record<CriterionRating, string>;
  /** Advisory action suggested when the rating is below 3. */
  remediation: string;
}

export const FRASCATI_CRITERIA: readonly CriterionDefinition[] = [
  {
    id: 'NOVELTY',
    label: 'Újszerűség',
    englishLabel: 'Novelty',
    weight: 25,
    question:
      'Új tudásra irányul-e a projekt, amely túlmutat a szakterület közismert állásán (nem csak a cég számára új)?',
    anchors: {
      0: 'Piacon elérhető megoldás átvétele',
      1: 'Csak a cég számára új',
      2: 'Hazai szinten új, nemzetközileg ismert',
      3: 'Iparági szinten új megközelítés',
      4: 'Dokumentált technológiai újdonság (irodalomkutatás / szabadalmi keresés)',
    },
    remediation:
      'Készüljön szakirodalmi és szabadalmi állapotfelmérés (state-of-the-art), amely igazolja a meglévő tudáson túlmutató célt.',
  },
  {
    id: 'CREATIVITY',
    label: 'Alkotó elem / Kreativitás',
    englishLabel: 'Creativity',
    weight: 20,
    question:
      'Eredeti, nem nyilvánvaló koncepciókon és hipotéziseken alapul-e a munka, amelyet a szakértő személyzet dolgoz ki?',
    anchors: {
      0: 'Rutinszerű mérnöki munka',
      1: 'Ismert módszerek kisebb adaptációja',
      2: 'Részben egyedi műszaki koncepció',
      3: 'Saját koncepció, több megoldási alternatíva',
      4: 'Eredeti hipotézisek, szakértői csapat által kidolgozva',
    },
    remediation:
      'Rögzíteni kell a műszaki hipotéziseket, a vizsgált megoldási alternatívákat és a kutatói szerepköröket.',
  },
  {
    id: 'UNCERTAINTY',
    label: 'Bizonytalanság / Kockázat',
    englishLabel: 'Uncertainty',
    weight: 25,
    question:
      'Előre bizonytalan-e a végeredmény, a költség vagy az elérési út – azaz fennáll-e a technológiai kudarc valós kockázata?',
    anchors: {
      0: 'Az eredmény előre ismert',
      1: 'Csak ütemezési / üzleti kockázat',
      2: 'Részleges technológiai bizonytalanság',
      3: 'Jelentős technológiai kockázat',
      4: 'Dokumentált kudarc-forgatókönyvek, iteratív kísérletek',
    },
    remediation:
      'Kockázati napló és kísérleti jegyzőkönyvek szükségesek, amelyek a sikertelen iterációkat is rögzítik.',
  },
  {
    id: 'SYSTEMATIC',
    label: 'Rendszerezettség / Dokumentáció',
    englishLabel: 'Systematic',
    weight: 15,
    question:
      'Tervezetten, dokumentáltan, célokkal, erőforrás- és költségtervvel folyik-e a munka?',
    anchors: {
      0: 'Nincs projektterv',
      1: 'Informális tervezés',
      2: 'Projektterv van, költségkövetés nincs',
      3: 'Projektterv + mérföldkövek + költségkövetés',
      4: 'Teljes projektdokumentáció, munkaidő-nyilvántartás, analitika',
    },
    remediation:
      'Projektalapító dokumentum, mérföldkő-terv és projektszintű munkaidő-nyilvántartás bevezetése szükséges.',
  },
  {
    id: 'TRANSFERABILITY',
    label: 'Átadhatóság / Reprodukálhatóság',
    englishLabel: 'Transferability',
    weight: 15,
    question:
      'Az eredmények rögzíthetők, átadhatók és reprodukálhatók-e (tudásanyag, műszaki leírás, szellemi tulajdon)?',
    anchors: {
      0: 'Az eredmény csak a fejlesztők fejében létezik',
      1: 'Szórványos jegyzetek',
      2: 'Belső műszaki leírás',
      3: 'Reprodukálható műszaki dokumentáció',
      4: 'Oltalomképes / publikálható eredmény, tudásbázis',
    },
    remediation:
      'Az eredményeket reprodukálható műszaki jelentésben kell rögzíteni; érdemes az iparjogvédelmi lehetőségeket is felmérni.',
  },
] as const;

export interface RedFlagDefinition<Id extends RedFlagId = RedFlagId> {
  id: Id;
  label: string;
  description: string;
  /** Points deducted from the weighted score. */
  penalty: number;
  /** A critical flag caps the final score in the RED band on its own. */
  critical: boolean;
  remediation: string;
}

/**
 * Typical NAV challenge patterns: activities the tax authority tends to
 * reclassify as production preparation or routine work (Frascati exclusions).
 */
export const RED_FLAGS: readonly RedFlagDefinition<GeneralRedFlagId>[] = [
  {
    id: 'PRODUCTION_PREP',
    label: 'Gyártás-előkészítés / sorozatgyártásra átállás',
    description:
      'A költségek jelentős része szerszámozásra, gyártósor-beállításra vagy próbagyártásra esik.',
    penalty: 25,
    critical: true,
    remediation:
      'A gyártás-előkészítési költségeket el kell különíteni a K+F projekttől; kizárólag a prototípus-fázisig tartó munka számolható el.',
  },
  {
    id: 'ROUTINE_QA',
    label: 'Rutinszerű minőségellenőrzés, tesztelés',
    description: 'Szabványos mérések, bevizsgálások ismert módszertannal.',
    penalty: 15,
    critical: false,
    remediation:
      'A rutinszerű minőségügyi teszteket ki kell venni a K+F költségalapból; csak a kísérleti validációs tesztek maradhatnak.',
  },
  {
    id: 'CUSTOMER_CUSTOMISATION',
    label: 'Ügyfélspecifikus testreszabás ismert technológiával',
    description: 'Meglévő termék megrendelői igény szerinti módosítása.',
    penalty: 15,
    critical: false,
    remediation:
      'Ki kell mutatni, hogy a testreszabás új műszaki probléma megoldását igényelte; ellenkező esetben a tétel nem K+F.',
  },
  {
    id: 'NO_HYPOTHESIS',
    label: 'Nincs dokumentált hipotézis / kísérleti terv',
    description: 'A munka célja és a vizsgált kérdés utólag nem rekonstruálható.',
    penalty: 10,
    critical: false,
    remediation:
      'Utólagos (retrospektív) műszaki hipotézis-dokumentáció készítése a meglévő e-mailek, jegyzőkönyvek alapján.',
  },
  {
    id: 'NO_TIME_TRACKING',
    label: 'Nincs projektszintű munkaidő-nyilvántartás',
    description: 'A kutatói bérek K+F-arányos felosztása nem igazolható.',
    penalty: 10,
    critical: false,
    remediation:
      'Projektkódos munkaidő-nyilvántartás bevezetése; a múltbeli évekre becslési módszertan dokumentálása.',
  },
] as const;

/**
 * Industry-specific patterns the tax authority typically reclassifies as
 * routine work or production preparation (Frascati exclusions).
 */
export const INDUSTRY_RED_FLAGS: Record<Industry, readonly RedFlagDefinition<IndustryRedFlagId>[]> = {
  MACHINERY_AUTOMATION: [
    {
      id: 'TOOLING_CERTIFICATION',
      label: 'Szerszámgyártás, készülékezés, CE-megfelelőség',
      description: 'Sorozatgyártási szerszámok, készülékek tervezése, gép-megfelelőségi tanúsítás.',
      penalty: 15,
      critical: false,
      remediation:
        'A szerszámozási és tanúsítási költségeket külön kell választani; csak az új műszaki megoldás kísérleti fázisa K+F.',
    },
    {
      id: 'MACHINE_RECONFIGURATION',
      label: 'Meglévő gép ügyfél-specifikus átkonfigurálása',
      description: 'Ismert géptípus paraméterezése, méretezése egy megrendelő igényei szerint.',
      penalty: 10,
      critical: false,
      remediation:
        'Igazolni kell, hogy az átalakítás új, előre nem ismert műszaki probléma megoldását igényelte.',
    },
  ],
  CHEMICALS_MATERIALS: [
    {
      id: 'SCALE_UP',
      label: 'Ismert receptúra méretnövelése (scale-up)',
      description: 'Laboratóriumban már működő eljárás üzemi méretre vitele technológiai kérdés nélkül.',
      penalty: 15,
      critical: false,
      remediation:
        'Csak az a scale-up K+F, ahol a méretnövelés új, dokumentált technológiai bizonytalanságot old fel.',
    },
    {
      id: 'STANDARD_MATERIAL_TESTING',
      label: 'Szabványos anyagvizsgálat, akkreditált mérés',
      description: 'Ismert módszertanú bevizsgálás, minőségtanúsítás, rutinanalitika.',
      penalty: 10,
      critical: false,
      remediation:
        'A szabványos bevizsgálásokat ki kell venni a költségalapból; csak a kísérleti hipotézist tesztelő mérések maradhatnak.',
    },
  ],
  FOOD: [
    {
      id: 'RECIPE_VARIANT',
      label: 'Meglévő recept íz-, kiszerelés- vagy csomagolásváltozata',
      description: 'Termékcsalád bővítése ismert technológiával.',
      penalty: 15,
      critical: false,
      remediation:
        'Ki kell mutatni az új technológiai kérdést (pl. új tartósítási eljárás, összetevő-kölcsönhatás); a puszta ízvariáns nem K+F.',
    },
    {
      id: 'ROUTINE_SHELF_LIFE',
      label: 'Rutinszerű eltarthatósági, érzékszervi vizsgálat',
      description: 'Előírt, ismert módszerű termékvizsgálatok.',
      penalty: 10,
      critical: false,
      remediation:
        'Csak az új eljárás hatását vizsgáló, kísérleti tervvel végzett tesztek számolhatók el.',
    },
  ],
  ELECTRONICS_IOT: [
    {
      id: 'EMC_CERTIFICATION',
      label: 'EMC / CE-tanúsítás, szabványos megfelelőségi mérés',
      description: 'Termék forgalomba hozatalához szükséges bevizsgálás.',
      penalty: 10,
      critical: false,
      remediation:
        'A tanúsítási költségeket el kell különíteni; csak a fejlesztés közbeni kísérleti mérések számolhatók el.',
    },
    {
      id: 'COMPONENT_REPLACEMENT',
      label: 'Alkatrész-kiváltás funkcióváltozás nélkül',
      description: 'Megszűnő (end-of-life) alkatrész cseréje egyenértékűre.',
      penalty: 15,
      critical: false,
      remediation:
        'Igazolni kell, hogy a kiváltás új tervezési problémát vetett fel (pl. teljesítmény, hőkezelés); ellenkező esetben rutinmunka.',
    },
  ],
  SOFTWARE_DIGITAL: [
    {
      id: 'SOFTWARE_MAINTENANCE',
      label: 'Rutinszerű hibajavítás, karbantartás, verziófrissítés',
      description: 'Meglévő rendszer üzemeltetése, hibák javítása, függőségek frissítése.',
      penalty: 15,
      critical: false,
      remediation:
        'A karbantartási feladatokat feladatszinten el kell különíteni; csak a technológiai bizonytalanságot feloldó fejlesztés K+F.',
    },
    {
      id: 'DATA_MIGRATION_REPORTING',
      label: 'Adatmigráció, riportkészítés, felületi átalakítás',
      description: 'Ismert eszközökkel végzett integráció, riport- vagy UI-munka.',
      penalty: 10,
      critical: false,
      remediation:
        'Ezek a feladatok a Frascati szerint jellemzően nem K+F; a projektből ki kell venni vagy a K+F-tartalmat dokumentálni kell.',
    },
  ],
  OTHER: [],
};

/** All red flags that are scored for a given industry. */
export const redFlagsFor = (industry: Industry): readonly RedFlagDefinition[] => [
  ...RED_FLAGS,
  ...INDUSTRY_RED_FLAGS[industry],
];

/** Score bands (inclusive lower bounds). */
export const RISK_THRESHOLDS = {
  GREEN: 80,
  YELLOW: 50,
} as const;

/**
 * Frascati treats the five criteria as cumulative: an activity is R&D only if
 * *all* of them are met. A zero on any criterion therefore caps the score just
 * below the YELLOW band regardless of the other ratings.
 */
export const KNOCKOUT_CAP = RISK_THRESHOLDS.YELLOW - 1;

export const RISK_LABELS = {
  GREEN: { title: 'Adóálló', subtitle: 'Azonnal SZTNH-képes' },
  YELLOW: { title: 'Kiegészítendő', subtitle: 'Kiegészítő dokumentációt igényel' },
  RED: { title: 'NAV-kockázat', subtitle: 'Gyártás-előkészítés / rutintevékenység veszélye' },
} as const;
