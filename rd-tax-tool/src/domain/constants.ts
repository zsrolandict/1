/**
 * Statutory rates and methodology constants.
 *
 * Every number the engine uses lives here so that a change in legislation is
 * a one-line edit reviewed by the tax team, not a hunt through UI code.
 */
import type {
  CriterionRating,
  FrascatiCriterionId,
  Industry,
  RedFlagId,
} from './types';

export const TAX_RATES = {
  /** Szociális hozzájárulási adó – Szocho tv. */
  SZOCHO: 0.13,
  /** Szocho tv. 15. §: share of szocho waived for R&D staff without a doctorate. */
  SZOCHO_RELIEF_STANDARD: 0.5,
  /** Szocho tv. 15. §: share waived for staff holding a PhD / scientific degree. */
  SZOCHO_RELIEF_PHD: 1.0,
  /** Társasági adó – Tao. tv. 19. § */
  CIT: 0.09,
  /** Default local business tax rate (statutory maximum) – Htv. 40. § */
  HIPA_DEFAULT: 0.02,
  HIPA_MAX: 0.02,
  /** Innovációs járulék – Inno. tv., base equals the HIPA base. */
  INNOVATION_CONTRIBUTION: 0.003,
} as const;

export const LEGAL_REFERENCES = {
  SZOCHO: 'Szocho tv. 15. §',
  CIT: 'Tao. tv. 7. § (1) t)',
  HIPA: 'Htv. 39. §',
  INNOVATION: 'Inno. tv. (járulékalap = HIPA-alap)',
} as const;

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

export interface RedFlagDefinition {
  id: RedFlagId;
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
export const RED_FLAGS: readonly RedFlagDefinition[] = [
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
