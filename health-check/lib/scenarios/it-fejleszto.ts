import { buildItems, sectorItem, type Scenario } from './types';

// KITALÁLT mintaeset – valós céget nem ábrázol.

const NOTES = `[00:00:22] Kérdező: Mennyire függnek a legnagyobb ügyféltől?
[00:00:30] Ügyvezető: Ők a forgalom kicsit több mint felét adják, de stabil a kapcsolat, a szerződés határozatlan idejű, nem tudnak csak úgy kilépni.
[00:01:20] Kérdező: Ki birtokolja a forráskódot?
[00:01:27] Ügyvezető: A fejlesztők mind nekünk dolgoznak, a kód a mi GitLabunkon van, tehát egyértelműen a miénk.
[00:02:15] Kérdező: Használnak nyílt forráskódú komponenseket?
[00:02:21] Ügyvezető: Csak MIT és Apache licencűeket, erre a CTO nagyon figyel.
[00:03:10] Kérdező: Mi lenne, ha a CTO távozna?
[00:03:16] Ügyvezető: Az nagy baj lenne, az architektúrát csak ő látja át teljesen.
[00:04:05] Kérdező: A számlás fejlesztők hogyan dolgoznak?
[00:04:11] Ügyvezető: Ugyanúgy bejárnak, mint az alkalmazottak, a céges laptopon dolgoznak és a sprintekhez igazodnak.`;

export const IT_FEJLESZTO: Scenario = {
  id: 'it-fejleszto',
  label: 'IT-fejlesztő cég',
  sector: 'Egyedi szoftverfejlesztés, pénzügyi szektor',
  situation: 'A tulajdonosok 18 hónapon belül befektetőt vonnának be; eladói átvilágítással készülnek.',
  companyName: 'Példa Szoftverház Kft.',
  sectors: ['IT'],
  kind: 'VENDOR_DD',
  company: { revenueHuf: 2_100_000_000, grossMarginPct: 0.3, actualDsoDays: 75, industryDsoDays: 50 },
  materialityHuf: 40_000_000,
  items: buildItems(
    {
      'LEG-01': {
        identified: true, likelihood: 3, impact: 5,
        description: 'A legnagyobb ügyfél keretszerződése tulajdonosváltáskor azonnali felmondást enged.',
        valuation: { formula: { type: 'REVENUE_SHARE', share: 0.55, marginBased: true, label: 'legnagyobb ügyfél árbevétel-aránya' }, overrideHuf: null },
      },
      'LEG-02': {
        identified: true, likelihood: 4, impact: 5, exposureHuf: 150_000_000, serviceFeeHuf: 900_000,
        description: '12 számlás fejlesztőből 9 szerződésében nincs szerzői jogi átruházás.',
        reasoning: 'A termék forráskódjának jelentős részét számlás fejlesztők írták, akiknek a szerződése nem tartalmaz vagyoni jogi átruházást vagy kizárólagos felhasználási engedélyt. A kód fizikai birtoklása nem jelent jogosultságot: befektetői átvilágításon ez a cég fő eszközének jogcímét kérdőjelezi meg.',
      },
      'HR-01': {
        identified: true, likelihood: 3, impact: 5,
        description: 'Az architektúrát egyedül a CTO látja át; nincs dokumentáció és helyettes.',
        valuation: { formula: { type: 'REVENUE_SHARE', share: 0.4, marginBased: true, label: 'CTO-tól függő fejlesztési bevétel' }, overrideHuf: null },
      },
      'HR-02': {
        identified: true, likelihood: 4, impact: 4, exposureHuf: 45_000_000,
        description: '12 számlás fejlesztő alkalmazotti munkarendben, céges eszközökkel.',
      },
      'FIN-03': { identified: true, likelihood: 3, impact: 3 },
      'OPS-02': { identified: true, likelihood: 3, impact: 3, exposureHuf: 30_000_000 },
      'LEG-04': { identified: true, likelihood: 2, impact: 4, exposureHuf: 20_000_000 },
    },
    [
      sectorItem({
        code: 'ITF-01', pillar: 'LEGAL', title: 'Copyleft licencű komponensek az értékesített termékben',
        description: 'A kódszkenner 3 GPL licencű komponenst talált az ügyfeleknek szállított termékben.',
        likelihood: 3, impact: 4, exposureHuf: 60_000_000, remediationDays: 20,
        remediation: 'Licencaudit, érintett komponensek cseréje vagy leválasztása, licencpolitika bevezetése.',
        division: 'LEGAL', serviceFeeHuf: 900_000,
        reasoning: 'Az ügyfeleknek szállított termékben copyleft (GPL) licencű komponensek vannak, amelyek a licencfeltételek szerint a teljes származékos mű forráskódjának közzétételét követelhetik meg. Ez az ügyfélszerződésekkel és a termék értékével is ütközhet; befektetői átvilágításon rendszeresen feltárt probléma.',
      }),
      sectorItem({
        code: 'ITF-02', pillar: 'LEGAL', title: 'Korlátlan felelősség és SLA-kötbér az ügyfélszerződésekben',
        description: 'A top 3 ügyfélszerződésből kettőben nincs felelősségkorlátozás; az SLA-mellékletek hiányoznak.',
        likelihood: 3, impact: 4, exposureHuf: 50_000_000, remediationDays: 15,
        remediation: 'Felelősségkorlátozás és SLA-kötbérplafon újratárgyalása; szerződésminta.',
        division: 'LEGAL', serviceFeeHuf: 800_000,
        reasoning: 'A legnagyobb ügyfélszerződések nem korlátozzák a szolgáltató felelősségét, az SLA-kötbérek plafon nélküliek. Egy komolyabb kiesés vagy adatvesztés esetén a kártérítés meghaladhatja az éves szerződéses díjat.',
      }),
      sectorItem({
        code: 'ITF-03', pillar: 'OPERATIONS', title: 'Információbiztonsági megfelelés hiányai',
        description: 'A pénzügyi szektorbeli ügyfelek biztonsági elvárásainak teljesítése nem dokumentált.',
        likelihood: 3, impact: 4, exposureHuf: 35_000_000, remediationDays: 30,
        remediation: 'Információbiztonsági szabályzat, hozzáférés-kezelés, incidenskezelési eljárás, külső audit.',
        division: 'ADVISORY', serviceFeeHuf: 1_000_000,
        reasoning: 'A pénzügyi szektorbeli ügyfelek egyre szigorúbb információbiztonsági megfelelést várnak el beszállítóiktól. Dokumentált szabályzat, hozzáférés-kezelés és incidenskezelés hiányában a társaság a következő szerződésmegújításnál vagy ügyfél-auditnál kieshet.',
      }),
      sectorItem({
        code: 'ITF-04', pillar: 'OPERATIONS', title: 'Hiányzó rendszerdokumentáció és forráskód-letét',
        description: 'Nincs architektúra-dokumentáció; az ügyfelek felé vállalt forráskód-letét nem teljesül.',
        likelihood: 2, impact: 3, exposureHuf: 10_000_000, remediationDays: 20,
        remediation: 'Architektúra-dokumentáció, forráskód-letéti megállapodás, tudásmegosztási rend.',
        division: 'ADVISORY', serviceFeeHuf: 500_000,
        reasoning: 'A rendszer felépítése nincs dokumentálva, és az egyes ügyfelek felé vállalt forráskód-letét sem teljesül. Ez növeli a kulcsember-függőséget, és szerződésszegési kockázatot hordoz.',
      }),
    ],
  ),
  facts: [
    { id: 'F1', pillar: 'LEGAL', statement: 'A legnagyobb ügyféllel kötött keretszerződés 14.2 pontja tulajdonosváltáskor azonnali felmondást enged.', source: 'Keretszerződés #1, 11. o. 14.2 pont' },
    { id: 'F2', pillar: 'LEGAL', statement: 'A 12 számlás fejlesztő közül 9 megbízási szerződésében nincs szerzői jogi átruházási rendelkezés.', source: 'Megbízási szerződések (12 db), AI-előszűrés' },
    { id: 'F3', pillar: 'LEGAL', statement: 'A kódbázis-szkenner 3 GPL licencű komponenst talált az ügyfeleknek értékesített termékben.', source: 'Licencszkennelési riport, 2026. 08.' },
    { id: 'F4', pillar: 'OPERATIONS', statement: 'A 2025-ös főkönyv szerint a legnagyobb ügyfél a bevétel 55%-át adta.', source: 'Főkönyv 2025, vevőanalitika' },
  ],
  missingDocuments: [
    { title: 'SLA-mellékletek a top 3 ügyfélszerződéshez', pillar: 'LEGAL' },
    { title: 'Információbiztonsági szabályzat', pillar: 'OPERATIONS' },
  ],
  interview: {
    role: 'OWNER_CEO',
    notes: NOTES,
    analysis: {
      summary:
        'A legnagyobb ügyfél a forgalom több mint felét adja; az ügyvezető szerint a szerződés nem mondható fel, holott tulajdonosváltáskor azonnali felmondást enged, ami befektetőbevonásnál a legkritikusabb pont. A forráskód jogát a GitLab-birtoklásra alapozza, de 9 fejlesztő szerződéséből hiányzik a jogátruházás. A licencpolitikáról tett állítás ellentmond a szkennelési riportnak. A CTO-függőség és a számlás fejlesztők munkaviszony jellegű foglalkoztatása további jelentős kockázat.',
      statements: [
        { pillar: 'OPERATIONS', summary: 'A legnagyobb ügyfél a forgalom több mint felét adja.', quote: 'Ők a forgalom kicsit több mint felét adják', speaker: '', startMs: null },
        { pillar: 'HR', summary: 'Az architektúrát csak a CTO látja át.', quote: 'az architektúrát csak ő látja át teljesen', speaker: '', startMs: null },
        { pillar: 'HR', summary: 'A számlás fejlesztők alkalmazotti rendben dolgoznak.', quote: 'Ugyanúgy bejárnak, mint az alkalmazottak', speaker: '', startMs: null },
      ],
      suggestedRedFlags: [
        { templateCode: 'HR-01', pillar: 'HR', title: 'Kulcsember-függőség (HR 361)', rationale: 'A rendszer architektúrája egyetlen ember fejében van.', quote: 'az architektúrát csak ő látja át teljesen', startMs: null, likelihood: 4, impact: 5, exposureHufEstimate: null, confidence: 0.9 },
        { templateCode: 'HR-02', pillar: 'HR', title: 'Színlelt vállalkozói jogviszonyok', rationale: 'Kötött munkarend, céges eszköz, integrált csapatmunka.', quote: 'a céges laptopon dolgoznak és a sprintekhez igazodnak', startMs: null, likelihood: 4, impact: 4, exposureHufEstimate: null, confidence: 0.85 },
        { templateCode: 'ITF-01', pillar: 'LEGAL', title: 'Copyleft licencű komponensek az értékesített termékben', rationale: 'A vezetés szerint nincs copyleft komponens, a riport szerint van.', quote: 'Csak MIT és Apache licencűeket', startMs: null, likelihood: 3, impact: 4, exposureHufEstimate: null, confidence: 0.8 },
      ],
      contradictions: [
        { pillar: 'LEGAL', claim: 'A forráskód egyértelműen a cégé.', quote: 'a kód a mi GitLabunkon van, tehát egyértelműen a miénk', startMs: null, conflictingFactId: 'F2', conflictingSource: '', explanation: 'A kód fizikai birtoklása nem ruházza át a szerzői vagyoni jogokat; 9 fejlesztő szerződéséből ez hiányzik. Befektetői átvilágításon ez a fő eszköz jogcímét érinti.', severity: 'HIGH' },
        { pillar: 'LEGAL', claim: 'Csak megengedő licencű komponenseket használnak.', quote: 'Csak MIT és Apache licencűeket', startMs: null, conflictingFactId: 'F3', conflictingSource: '', explanation: 'A szkenner 3 GPL komponenst talált az értékesített termékben; a licencpolitika a gyakorlatban nem érvényesül.', severity: 'HIGH' },
        { pillar: 'LEGAL', claim: 'A legnagyobb ügyfél nem tud kilépni.', quote: 'nem tudnak csak úgy kilépni', startMs: null, conflictingFactId: 'F1', conflictingSource: '', explanation: 'A keretszerződés tulajdonosváltáskor azonnali felmondást enged: befektető belépése a bevétel több mint felét kockáztatja.', severity: 'HIGH' },
      ],
      followUpQuestions: [
        'Hajlandók-e a számlás fejlesztők utólagos jogátruházási nyilatkozatot aláírni, és milyen feltétellel?',
        'Melyik termékmodulban vannak a GPL komponensek, és kiváltható-e mindhárom?',
        'Tárgyaltak-e már a legnagyobb ügyféllel a tulajdonosváltási záradékról?',
      ],
    },
  },
};
