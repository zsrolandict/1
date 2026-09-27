import type { ActionWindow, Division, Pillar, Rag, RiskItem } from './types';

export const PILLAR_LABEL: Record<Pillar, string> = {
  FINANCE: 'Pénzügy / Adó',
  LEGAL: 'Jog',
  OPERATIONS: 'Operáció',
  HR: 'HR',
};

export const DIVISION_LABEL: Record<Division, string> = {
  LEGAL: 'ICT Legal',
  TAX: 'ICT Adó',
  ACCOUNTING: 'ICT Könyvelés',
  HR: 'ICT HR',
  ADVISORY: 'ICT Advisory',
};

export const RAG_LABEL: Record<Rag, string> = {
  GREEN: 'Zöld',
  AMBER: 'Sárga',
  RED: 'Piros',
};

export const WINDOW_LABEL: Record<ActionWindow, string> = {
  D0_30: '0–30 nap · Quick wins',
  D31_60: '31–60 nap · Kritikus javítások',
  D61_90: '61–90 nap · Strukturális lépések',
  BACKLOG: '90 napon túl · Monitoring',
};

/**
 * Alapértelmezett Red Flag katalógus (4 pillér × 4 tétel).
 * Élesben a `risk_templates` táblából töltődik; ez a seed és a demo forrása.
 */
export const DEFAULT_CATALOG: RiskItem[] = [
  // ── Pénzügy / Adó ───────────────────────────────────────────────
  {
    id: 'FIN-01', code: 'FIN-01', pillar: 'FINANCE',
    title: 'Transzferár-dokumentáció hiánya',
    description: 'Kapcsolt feles ügyletek (> 50 M Ft) nyilvántartási kötelezettsége nem teljesült.',
    identified: true, likelihood: 4, impact: 4, exposureHuf: 8_000_000, remediationDays: 15,
    remediation: 'Transzferár-nyilvántartás elkészítése 2 évre visszamenőleg, önellenőrzés vizsgálata.',
    division: 'TAX', serviceFeeHuf: 1_800_000,
  },
  {
    id: 'FIN-02', code: 'FIN-02', pillar: 'FINANCE',
    title: 'Nem normalizált, egyszeri tételekkel torzított EBITDA',
    description: 'Tulajdonosi költségek, egyszeri bevételek és piaci ár alatti bérleti díj az eredményben.',
    identified: true, likelihood: 4, impact: 3, exposureHuf: 25_000_000, remediationDays: 4,
    remediation: 'Normalizált EBITDA híd elkészítése, tulajdonosi költségek leválasztása.',
    division: 'ADVISORY', serviceFeeHuf: 600_000,
  },
  {
    id: 'FIN-03', code: 'FIN-03', pillar: 'FINANCE',
    title: 'Lejárt vevőállomány koncentrációja',
    description: 'A 90 napon túli követelések > 15%-a egy vevőnél.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 12_000_000, remediationDays: 10,
    remediation: 'Követeléskezelési szabályzat, értékvesztés-elszámolás felülvizsgálata.',
    division: 'ACCOUNTING', serviceFeeHuf: 400_000,
  },
  {
    id: 'FIN-04', code: 'FIN-04', pillar: 'FINANCE',
    title: 'Főkönyv–bevallás eltérés (ÁFA analitika)',
    description: 'Az ÁFA analitika és a NAV online számla adatai között egyeztetetlen különbözet.',
    identified: false, likelihood: 3, impact: 4, exposureHuf: 6_000_000, remediationDays: 5,
    remediation: 'ÁFA egyeztetés, szükség esetén önellenőrzés; könyvelés-átvétel ajánlat.',
    division: 'ACCOUNTING', serviceFeeHuf: 900_000,
  },
  // ── Jog ─────────────────────────────────────────────────────────
  {
    id: 'LEG-01', code: 'LEG-01', pillar: 'LEGAL',
    title: 'Change of Control záradék kulcsszerződésben',
    description: 'A top 5 vevői szerződésből legalább egy tulajdonosváltáskor felmondható.',
    identified: true, likelihood: 3, impact: 5, exposureHuf: 120_000_000, remediationDays: 20,
    remediation: 'Újratárgyalás / előzetes waiver beszerzése a partnertől.',
    division: 'LEGAL', serviceFeeHuf: 1_500_000,
  },
  {
    id: 'LEG-02', code: 'LEG-02', pillar: 'LEGAL',
    title: 'Hiányzó IP-átruházás (fejlesztők, alvállalkozók)',
    description: 'A szoftver / know-how vagyoni jogai nem szálltak át a társaságra.',
    identified: true, likelihood: 4, impact: 4, exposureHuf: 30_000_000, remediationDays: 5,
    remediation: 'Utólagos felhasználási / átruházási szerződések aláíratása.',
    division: 'LEGAL', serviceFeeHuf: 700_000,
  },
  {
    id: 'LEG-03', code: 'LEG-03', pillar: 'LEGAL',
    title: 'Elavult létesítő okirat / SZMSZ',
    description: 'A cégkivonat, a társasági szerződés és a tényleges működés eltér.',
    identified: false, likelihood: 2, impact: 2, exposureHuf: 500_000, remediationDays: 3,
    remediation: 'Létesítő okirat módosítása, változásbejegyzés.',
    division: 'LEGAL', serviceFeeHuf: 350_000,
  },
  {
    id: 'LEG-04', code: 'LEG-04', pillar: 'LEGAL',
    title: 'GDPR megfelelés hiányosságai',
    description: 'Nincs adatkezelési nyilvántartás, adatfeldolgozói szerződések hiányosak.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 10_000_000, remediationDays: 8,
    remediation: 'GDPR gyorsaudit, nyilvántartás és DPA-k elkészítése.',
    division: 'LEGAL', serviceFeeHuf: 800_000,
  },
  // ── Operáció ────────────────────────────────────────────────────
  {
    id: 'OPS-01', code: 'OPS-01', pillar: 'OPERATIONS',
    title: 'Beszállítói koncentráció (> 40% egy beszállító)',
    description: 'Kritikus alapanyag / szolgáltatás egyetlen forrásból, keretszerződés nélkül.',
    identified: true, likelihood: 3, impact: 4, exposureHuf: 40_000_000, remediationDays: 30,
    remediation: 'Második beszállító minősítése, keretszerződés árfolyam- és ellátási garanciával.',
    division: 'ADVISORY', serviceFeeHuf: 1_200_000,
  },
  {
    id: 'OPS-02', code: 'OPS-02', pillar: 'OPERATIONS',
    title: 'Technológiai adósság (nem támogatott ERP)',
    description: 'Gyártói támogatás nélküli ügyviteli rendszer, dokumentálatlan egyedi fejlesztések.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 15_000_000, remediationDays: 60,
    remediation: 'ERP migrációs roadmap, kritikus folyamatok dokumentálása.',
    division: 'ADVISORY', serviceFeeHuf: 1_000_000,
  },
  {
    id: 'OPS-03', code: 'OPS-03', pillar: 'OPERATIONS',
    title: 'Hiányzó üzletmenet-folytonossági terv',
    description: 'Nincs BCP / mentési teszt, egyetlen telephely.',
    identified: false, likelihood: 2, impact: 4, exposureHuf: 20_000_000, remediationDays: 10,
    remediation: 'BCP keretrendszer és mentés-visszaállítási teszt.',
    division: 'ADVISORY', serviceFeeHuf: 500_000,
  },
  {
    id: 'OPS-04', code: 'OPS-04', pillar: 'OPERATIONS',
    title: 'Engedélyek / hatósági megfelelés lejárata',
    description: 'Telephelyi, környezetvédelmi vagy tűzvédelmi engedély 6 hónapon belül lejár.',
    identified: false, likelihood: 2, impact: 3, exposureHuf: 3_000_000, remediationDays: 5,
    remediation: 'Engedély-nyilvántartás és megújítási naptár.',
    division: 'LEGAL', serviceFeeHuf: 250_000,
  },
  // ── HR ──────────────────────────────────────────────────────────
  {
    id: 'HR-01', code: 'HR-01', pillar: 'HR',
    title: 'Kulcsember-függőség (HR 361)',
    description: 'Az ügyvezető / értékesítési vezető távozása a bevétel > 30%-át veszélyezteti.',
    identified: true, likelihood: 3, impact: 5, exposureHuf: 60_000_000, remediationDays: 45,
    remediation: 'Utódlási terv, retenciós bónusz, versenytilalmi megállapodás.',
    division: 'HR', serviceFeeHuf: 900_000,
  },
  {
    id: 'HR-02', code: 'HR-02', pillar: 'HR',
    title: 'Színlelt vállalkozói jogviszonyok',
    description: 'Munkaviszony jellegű foglalkoztatás megbízási / számlás konstrukcióban.',
    identified: true, likelihood: 3, impact: 4, exposureHuf: 18_000_000, remediationDays: 15,
    remediation: 'Jogviszonyok minősítése és átalakítása; BVKK / cafeteria struktúra.',
    division: 'HR', serviceFeeHuf: 750_000,
  },
  {
    id: 'HR-03', code: 'HR-03', pillar: 'HR',
    title: 'Hiányos munkaidő-nyilvántartás',
    description: 'Túlmunka és pihenőidő nem dokumentált, munkaügyi ellenőrzési kockázat.',
    identified: false, likelihood: 3, impact: 2, exposureHuf: 2_000_000, remediationDays: 3,
    remediation: 'Munkaidő-nyilvántartási rendszer és belső szabályzat.',
    division: 'HR', serviceFeeHuf: 300_000,
  },
  {
    id: 'HR-04', code: 'HR-04', pillar: 'HR',
    title: 'Nem versenyképes javadalmazás / magas fluktuáció',
    description: 'Éves fluktuáció > 25% a kulcspozíciókban.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 8_000_000, remediationDays: 20,
    remediation: 'Bérbenchmark, ösztönzőrendszer (BVKK / MRP) kialakítása.',
    division: 'HR', serviceFeeHuf: 850_000,
  },
];
