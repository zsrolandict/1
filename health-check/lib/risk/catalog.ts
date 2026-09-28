import { EXPERT_PARAMETERS } from './parameters';
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
 * Alapértelmezett Red Flag katalógus (4 pillér, 17 tétel).
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
    reasoning: "A társaság kapcsolt vállalkozásaival bonyolított, jelentős értékű ügyleteire nem készült el a törvényben előírt transzferár-nyilvántartás. Adóellenőrzés esetén nyilvántartásonként mulasztási bírság szabható ki, és a kapcsolt árak piaci jellegét a társaságnak kell bizonyítania; tranzakció esetén a vevő ezt jellemzően kártalanítási kötelezettséggel vagy vételár-visszatartással kezeli.",
    valuation: { formula: { type: 'PER_ITEM', count: 4, unitAmountHuf: EXPERT_PARAMETERS.TP_EXPOSURE_PER_RECORD.valueHuf, paramKey: 'TP_EXPOSURE_PER_RECORD', label: 'hiányzó nyilvántartás' }, overrideHuf: null },
  },
  {
    id: 'FIN-02', code: 'FIN-02', pillar: 'FINANCE',
    title: 'Nem normalizált, egyszeri tételekkel torzított EBITDA',
    description: 'Tulajdonosi költségek, egyszeri bevételek és piaci ár alatti bérleti díj az eredményben.',
    identified: true, likelihood: 4, impact: 3, exposureHuf: 25_000_000, remediationDays: 4,
    remediation: 'Normalizált EBITDA híd elkészítése, tulajdonosi költségek leválasztása.',
    division: 'ADVISORY', serviceFeeHuf: 600_000,
    reasoning: "A kimutatott EBITDA tulajdonosi, egyszeri és nem piaci feltételű tételeket tartalmaz, így nem tükrözi a fenntartható működési eredményt. Egy vevő vagy finanszírozó a normalizálás során ezeket korrigálja, ami közvetlenül csökkenti a szorzó alapján számított cégértéket vagy a hitelképességet.",
  },
  {
    id: 'FIN-03', code: 'FIN-03', pillar: 'FINANCE',
    title: 'Lejárt vevőállomány koncentrációja',
    description: 'A 90 napon túli követelések > 15%-a egy vevőnél.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 12_000_000, remediationDays: 10,
    remediation: 'Követeléskezelési szabályzat, értékvesztés-elszámolás felülvizsgálata.',
    division: 'ACCOUNTING', serviceFeeHuf: 400_000,
    reasoning: "A vevőállomány jelentős része 90 napon túl lejárt, és egy vevőnél koncentrálódik. Ez többlet-forgótőkét köt le, rontja a likviditást, és az értékvesztés elszámolásának hiánya esetén az eredmény túlbecsült lehet.",
    valuation: { formula: { type: 'DSO_GAP', label: 'lekötött forgótőke' }, overrideHuf: null },
  },
  {
    id: 'FIN-04', code: 'FIN-04', pillar: 'FINANCE',
    title: 'Főkönyv–bevallás eltérés (ÁFA analitika)',
    description: 'Az ÁFA analitika és a NAV online számla adatai között egyeztetetlen különbözet.',
    identified: false, likelihood: 3, impact: 4, exposureHuf: 6_000_000, remediationDays: 5,
    remediation: 'ÁFA egyeztetés, szükség esetén önellenőrzés; könyvelés-átvétel ajánlat.',
    division: 'ACCOUNTING', serviceFeeHuf: 900_000,
    reasoning: "Az ÁFA-analitika és a NAV online számla adatai között egyeztetetlen eltérés van. Ez adóellenőrzés során adókülönbözet, önellenőrzési pótlék és bírság kockázatát hordozza, és a könyvelési folyamat kontrollhiányára utal.",
  },
  // ── Jog ─────────────────────────────────────────────────────────
  {
    id: 'LEG-01', code: 'LEG-01', pillar: 'LEGAL',
    title: 'Change of Control záradék kulcsszerződésben',
    description: 'A top 5 vevői szerződésből legalább egy tulajdonosváltáskor felmondható.',
    identified: true, likelihood: 3, impact: 5, exposureHuf: 120_000_000, remediationDays: 20,
    remediation: 'Újratárgyalás / előzetes waiver beszerzése a partnertől.',
    division: 'LEGAL', serviceFeeHuf: 1_500_000,
    reasoning: "A társaság kulcsfontosságú vevői szerződése tulajdonosváltási (Change of Control) záradékot tartalmaz, amely felvásárlás vagy új befektető belépése esetén egyoldalú felmondási jogot biztosít a partnernek. Tranzakció esetén ez közvetlen alkupozíció-romlást, vételár-csökkentést vagy árbevétel-kiesést okozhat.",
    valuation: { formula: { type: 'REVENUE_SHARE', share: 0.38, marginBased: true, label: 'érintett vevők árbevétel-aránya' }, overrideHuf: null },
  },
  {
    id: 'LEG-02', code: 'LEG-02', pillar: 'LEGAL',
    title: 'Hiányzó IP-átruházás (fejlesztők, alvállalkozók)',
    description: 'A szoftver / know-how vagyoni jogai nem szálltak át a társaságra.',
    identified: true, likelihood: 4, impact: 4, exposureHuf: 30_000_000, remediationDays: 5,
    remediation: 'Utólagos felhasználási / átruházási szerződések aláíratása.',
    division: 'LEGAL', serviceFeeHuf: 700_000,
    reasoning: "A társaság működéséhez szükséges szoftver, illetve know-how vagyoni jogai a fejlesztők és alvállalkozók szerződéseiben nem kerültek átruházásra, illetve a felhasználási jog terjedelme nem rendezett. A társaság így nem tudja igazolni a kulcsfontosságú szellemi tulajdon feletti rendelkezési jogát.",
  },
  {
    id: 'LEG-03', code: 'LEG-03', pillar: 'LEGAL',
    title: 'Elavult létesítő okirat / SZMSZ',
    description: 'A cégkivonat, a társasági szerződés és a tényleges működés eltér.',
    identified: false, likelihood: 2, impact: 2, exposureHuf: 500_000, remediationDays: 3,
    remediation: 'Létesítő okirat módosítása, változásbejegyzés.',
    division: 'LEGAL', serviceFeeHuf: 350_000,
    reasoning: "A létesítő okirat és a nyilvántartott cégadatok nem tükrözik a tényleges működést (képviselet, tevékenységi kör, tulajdonosi jogok). Ez tranzakció vagy finanszírozás esetén késedelmet és többletköltséget okoz, szélsőséges esetben a döntések érvényességét is érintheti.",
  },
  {
    id: 'LEG-04', code: 'LEG-04', pillar: 'LEGAL',
    title: 'GDPR megfelelés hiányosságai',
    description: 'Nincs adatkezelési nyilvántartás, adatfeldolgozói szerződések hiányosak.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 10_000_000, remediationDays: 8,
    remediation: 'GDPR gyorsaudit, nyilvántartás és DPA-k elkészítése.',
    division: 'LEGAL', serviceFeeHuf: 800_000,
    reasoning: "A társaság nem rendelkezik adatkezelési nyilvántartással, és az adatfeldolgozói szerződései hiányosak. Adatvédelmi incidens vagy panasz esetén a hatóság bírságot szabhat ki, és a hiányosság a vevői és partneri bizalmat is rontja.",
  },
  // ── Operáció ────────────────────────────────────────────────────
  {
    id: 'OPS-01', code: 'OPS-01', pillar: 'OPERATIONS',
    title: 'Beszállítói koncentráció (> 40% egy beszállító)',
    description: 'Kritikus alapanyag / szolgáltatás egyetlen forrásból, keretszerződés nélkül.',
    identified: true, likelihood: 3, impact: 4, exposureHuf: 40_000_000, remediationDays: 30,
    remediation: 'Második beszállító minősítése, keretszerződés árfolyam- és ellátási garanciával.',
    division: 'ADVISORY', serviceFeeHuf: 1_200_000,
    reasoning: "A kritikus alapanyag vagy szolgáltatás beszerzése egyetlen beszállítónál koncentrálódik, keretszerződés nélkül. Az ellátás kiesése vagy egyoldalú áremelés közvetlenül veszélyezteti a termelést és a fedezetet, miközben a társaság alkupozíciója gyenge.",
  },
  {
    id: 'OPS-02', code: 'OPS-02', pillar: 'OPERATIONS',
    title: 'Technológiai adósság (nem támogatott ERP)',
    description: 'Gyártói támogatás nélküli ügyviteli rendszer, dokumentálatlan egyedi fejlesztések.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 15_000_000, remediationDays: 60,
    remediation: 'ERP migrációs roadmap, kritikus folyamatok dokumentálása.',
    division: 'ADVISORY', serviceFeeHuf: 1_000_000,
    reasoning: "Az ügyviteli rendszer gyártói támogatás nélkül fut, és dokumentálatlan egyedi fejlesztésekre épül. Ez üzemzavar-, adatbiztonsági és adatvesztési kockázatot jelent, a csere pedig jelentős, előre nem tervezett beruházást igényel.",
  },
  {
    id: 'OPS-03', code: 'OPS-03', pillar: 'OPERATIONS',
    title: 'Hiányzó üzletmenet-folytonossági terv',
    description: 'Nincs BCP / mentési teszt, egyetlen telephely.',
    identified: false, likelihood: 2, impact: 4, exposureHuf: 20_000_000, remediationDays: 10,
    remediation: 'BCP keretrendszer és mentés-visszaállítási teszt.',
    division: 'ADVISORY', serviceFeeHuf: 500_000,
    reasoning: "A társaság nem rendelkezik üzletmenet-folytonossági tervvel, és a mentések visszaállítását nem tesztelte. Telephelyi vagy informatikai kiesés esetén a vevők kiszolgálása hosszabb időre leállhat.",
  },
  {
    id: 'OPS-04', code: 'OPS-04', pillar: 'OPERATIONS',
    title: 'Engedélyek / hatósági megfelelés lejárata',
    description: 'Telephelyi, környezetvédelmi vagy tűzvédelmi engedély 6 hónapon belül lejár.',
    identified: false, likelihood: 2, impact: 3, exposureHuf: 3_000_000, remediationDays: 5,
    remediation: 'Engedély-nyilvántartás és megújítási naptár.',
    division: 'LEGAL', serviceFeeHuf: 250_000,
    reasoning: "A működéshez szükséges egy vagy több hatósági engedély a közeljövőben lejár, és nincs kijelölt felelőse a megújításnak. Az engedély hiánya a tevékenység korlátozását vagy felfüggesztését és bírságot vonhat maga után.",
  },
  {
    id: 'OPS-05', code: 'OPS-05', pillar: 'OPERATIONS',
    title: 'Vevőkoncentráció (> 25% egy vevő)',
    description: 'Egyetlen vevő adja az árbevétel jelentős részét, hosszú távú szerződés nélkül.',
    identified: false, likelihood: 2, impact: 4, exposureHuf: 50_000_000, remediationDays: 30,
    remediation: 'Vevőportfólió bővítése, hosszú távú keretszerződés a kulcsvevővel.',
    division: 'ADVISORY', serviceFeeHuf: 900_000,
    reasoning: "Az árbevétel jelentős része egyetlen vevőhöz kötődik. A vevő elvesztése vagy egyoldalú árcsökkentési követelése közvetlenül a fedezetet érinti, a társaság alkupozíciója gyenge, és egy vevő vagy finanszírozó ezt a kockázatot a cégértékben vagy a hitelfeltételekben beárazza.",
    valuation: { formula: { type: 'REVENUE_SHARE', share: 0.25, marginBased: true, label: 'legnagyobb vevő árbevétel-aránya' }, overrideHuf: null },
  },
  // ── HR ──────────────────────────────────────────────────────────
  {
    id: 'HR-01', code: 'HR-01', pillar: 'HR',
    title: 'Kulcsember-függőség (HR 361)',
    description: 'Az ügyvezető / értékesítési vezető távozása a bevétel > 30%-át veszélyezteti.',
    identified: true, likelihood: 3, impact: 5, exposureHuf: 60_000_000, remediationDays: 45,
    remediation: 'Utódlási terv, retenciós bónusz, versenytilalmi megállapodás.',
    division: 'HR', serviceFeeHuf: 900_000,
    reasoning: "A társaság árbevételének és kulcs vevői kapcsolatainak jelentős része egyetlen vezetőhöz kötődik, akinek nincs kijelölt és felkészített helyettese, illetve megtartási és versenytilalmi megállapodása. Távozása esetén a bevétel és az ügyfélkapcsolatok jelentős része veszélybe kerül.",
    valuation: { formula: { type: 'REVENUE_SHARE', share: 0.3, marginBased: true, label: 'kulcsemberhez kötött árbevétel' }, overrideHuf: null },
  },
  {
    id: 'HR-02', code: 'HR-02', pillar: 'HR',
    title: 'Színlelt vállalkozói jogviszonyok',
    description: 'Munkaviszony jellegű foglalkoztatás megbízási / számlás konstrukcióban.',
    identified: true, likelihood: 3, impact: 4, exposureHuf: 18_000_000, remediationDays: 15,
    remediation: 'Jogviszonyok minősítése és átalakítása; BVKK / cafeteria struktúra.',
    division: 'HR', serviceFeeHuf: 750_000,
    reasoning: "A társaság munkaviszony jellegű feladatokat megbízási vagy számlás konstrukcióban láttat el. Munkaügyi vagy adóellenőrzés esetén a jogviszony átminősíthető, ami visszamenőleges közteher-, járulék- és bírságkockázatot, valamint munkajogi igényeket keletkeztet.",
  },
  {
    id: 'HR-03', code: 'HR-03', pillar: 'HR',
    title: 'Hiányos munkaidő-nyilvántartás',
    description: 'Túlmunka és pihenőidő nem dokumentált, munkaügyi ellenőrzési kockázat.',
    identified: false, likelihood: 3, impact: 2, exposureHuf: 2_000_000, remediationDays: 3,
    remediation: 'Munkaidő-nyilvántartási rendszer és belső szabályzat.',
    division: 'HR', serviceFeeHuf: 300_000,
    reasoning: "A munkaidő és a rendkívüli munkaidő nyilvántartása hiányos. Munkaügyi ellenőrzés esetén bírság, munkavállalói igényérvényesítés esetén pedig visszamenőleges bérkülönbözet-fizetés kockázata áll fenn.",
  },
  {
    id: 'HR-04', code: 'HR-04', pillar: 'HR',
    title: 'Nem versenyképes javadalmazás / magas fluktuáció',
    description: 'Éves fluktuáció > 25% a kulcspozíciókban.',
    identified: false, likelihood: 3, impact: 3, exposureHuf: 8_000_000, remediationDays: 20,
    remediation: 'Bérbenchmark, ösztönzőrendszer (BVKK / MRP) kialakítása.',
    division: 'HR', serviceFeeHuf: 850_000,
    reasoning: "A kulcspozíciókban magas a fluktuáció, a javadalmazás elmarad a piaci szinttől. Ez a tudás és a vevői kapcsolatok elvesztésének, valamint a toborzási és betanítási költségek növekedésének kockázatát hordozza.",
  },
];

const BY_CODE = new Map(DEFAULT_CATALOG.map((r) => [r.code, r]));

/** A katalógus alapértelmezett tétele kód alapján (indoklás / képlet visszaállításához). */
export function catalogDefault(code: string): RiskItem | undefined {
  return BY_CODE.get(code);
}
