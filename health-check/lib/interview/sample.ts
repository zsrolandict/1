import type { InterviewAnalysis, KnownFact } from './types';

/**
 * KITALÁLT demo adatok (Minta Gyártó Kft.) – bemutatáshoz és tesztekhez.
 * Élesben a tények a dokumentumok AI-előszűréséből (documents.ai_extraction)
 * és a csekklista-válaszokból jönnek.
 */
export const SAMPLE_FACTS: KnownFact[] = [
  {
    id: 'F1',
    pillar: 'LEGAL',
    statement: 'A Nordwind GmbH szállítási szerződés 11.3 pontja szerint tulajdonosváltás esetén a vevő 30 napos határidővel felmondhat.',
    source: 'Top 5 szerződés #1 (Nordwind GmbH), 7. o. 11.3 pont',
  },
  {
    id: 'F2',
    pillar: 'OPERATIONS',
    statement: 'A feltöltött anyagok között nincs keretszerződés a fő alapanyag-beszállítóval (Acél-Trade Kft.), amely a beszerzés 46%-át adja.',
    source: 'VDR: beszállítói szerződések mappa + főkönyv 2025',
  },
  {
    id: 'F3',
    pillar: 'LEGAL',
    statement: 'A vezérlőszoftvert fejlesztő 3 alvállalkozó megbízási szerződésében nincs szerzői jogi átruházási vagy felhasználási klauzula.',
    source: 'Megbízási szerződések (3 db), AI-előszűrés',
  },
  {
    id: 'F4',
    pillar: 'FINANCE',
    statement: 'A 2025-ös főkönyvben 38 M Ft bérleti díj szerepel a tulajdonos magánszemélytől bérelt csarnokra.',
    source: 'Főkönyv 2025, 529 számla',
  },
];

export const SAMPLE_MISSING_DOCUMENTS = [
  { title: 'Transzferár-nyilvántartás 2024–2025', pillar: 'FINANCE' as const },
  { title: 'Munkaszerződés-minták és munkaidő-nyilvántartás', pillar: 'HR' as const },
];

export const SAMPLE_NOTES = `[00:00:15] Kérdező: Köszönöm, hogy időt szánt ránk. Kezdjük a vevőkkel: melyik partner elvesztése okozná a legnagyobb kárt?
[00:00:32] Ügyvezető: Egyértelműen a Nordwind. Ők adják a forgalom nagyjából harmadát. De velük határozatlan idejű, stabil szerződésünk van, azt nem lehet csak úgy felmondani.
[00:01:10] Kérdező: És ha változna a tulajdonosi kör?
[00:01:18] Ügyvezető: Az szerintem őket nem érdekli, a kapcsolatot amúgy is személyesen én viszem, a beszerzési igazgatójukkal húsz éve ismerjük egymást.
[00:02:05] Kérdező: Beszállítói oldalon hogy állnak?
[00:02:12] Ügyvezető: Minden nagy beszállítóval keretszerződésünk van, ezt nagyon komolyan vesszük. Az Acél-Trade a legnagyobb, tőlük jön az anyag nagy része.
[00:03:40] Kérdező: A vezérlőszoftvert ki fejlesztette?
[00:03:47] Ügyvezető: Három külsős fejlesztő, számlára dolgoznak nekünk évek óta. A kód nálunk van a szerveren, úgyhogy az a miénk.
[00:04:30] Kérdező: Ha Ön három hónapig nem lenne elérhető, ki vinné a céget?
[00:04:38] Ügyvezető: Őszintén szólva senki. A nagy vevőket és az árazást én intézem, a kollégák az operatív dolgokat viszik.
[00:05:20] Kérdező: A csarnokot kitől bérlik?
[00:05:26] Ügyvezető: Tőlem, magánszemélyként. A bérleti díj szerintem a piaci fölött van egy kicsit, de ez így alakult ki.`;

/**
 * Előre elkészített elemzés a fenti jegyzethez – NEM élő AI-hívás eredménye.
 * A felület „Minta-elemzés” címkével mutatja; a verifyAnalysis ugyanúgy lefut rajta.
 */
export const SAMPLE_ANALYSIS_RAW: Omit<InterviewAnalysis, 'discardedUnverified'> = {
  summary:
    'Az ügyvezető szerint a Nordwind a forgalom kb. harmadát adja, a szerződést stabilnak és felmondhatatlannak tartja, ' +
    'ami ellentmond a szerződés Change of Control pontjának. A kulcsvevő-kapcsolat és az árazás kizárólag az ügyvezetőnél van, ' +
    'helyettese nincs. A beszállítói keretszerződésekről tett állítás nem egyezik a feltöltött anyagokkal. A vezérlőszoftver ' +
    'jogairól téves elképzelés él (a kód fizikai birtoklása nem jelent szerzői jogot). A tulajdonostól bérelt csarnok díja ' +
    'az ügyvezető szerint is piaci fölötti, ez EBITDA-normalizálást igényel.',
  statements: [
    { pillar: 'OPERATIONS', summary: 'A Nordwind a forgalom kb. harmadát adja.', quote: 'Ők adják a forgalom nagyjából harmadát', speaker: '', startMs: null },
    { pillar: 'HR', summary: 'Nincs helyettes; a nagy vevők és az árazás az ügyvezetőnél.', quote: 'A nagy vevőket és az árazást én intézem', speaker: '', startMs: null },
    { pillar: 'FINANCE', summary: 'A kapcsolt feles bérleti díj piaci fölötti.', quote: 'A bérleti díj szerintem a piaci fölött van egy kicsit', speaker: '', startMs: null },
  ],
  suggestedRedFlags: [
    {
      templateCode: 'HR-01', pillar: 'HR', title: 'Kulcsember-függőség (HR 361)',
      rationale: 'Az ügyvezető távollétében senki nem vinné a céget; a kulcsvevő-kapcsolat személyes.',
      quote: 'Őszintén szólva senki', startMs: null, likelihood: 4, impact: 5, exposureHufEstimate: null, confidence: 0.9,
    },
    {
      templateCode: 'LEG-02', pillar: 'LEGAL', title: 'Hiányzó IP-átruházás (fejlesztők, alvállalkozók)',
      rationale: 'Az ügyvezető a kód fizikai birtoklását tulajdonjognak tekinti; átruházási szerződés nem említett.',
      quote: 'A kód nálunk van a szerveren, úgyhogy az a miénk', startMs: null, likelihood: 4, impact: 4, exposureHufEstimate: null, confidence: 0.85,
    },
    {
      templateCode: 'FIN-02', pillar: 'FINANCE', title: 'Nem normalizált, egyszeri tételekkel torzított EBITDA',
      rationale: 'Piaci fölötti bérleti díj a tulajdonosnak – normalizálandó.',
      quote: 'A bérleti díj szerintem a piaci fölött van egy kicsit', startMs: null, likelihood: 4, impact: 3, exposureHufEstimate: null, confidence: 0.8,
    },
    {
      templateCode: null, pillar: 'LEGAL', title: 'Ez a tétel szándékosan hibás idézetű (a szűrő kiejti)',
      rationale: 'Demonstráció: a leiratban nem szereplő idézet nem jut a tanácsadó elé.',
      quote: 'A cégnek semmilyen adótartozása nincs és soha nem is volt', startMs: null, likelihood: 2, impact: 2, exposureHufEstimate: null, confidence: 0.5,
    },
  ],
  contradictions: [
    {
      pillar: 'LEGAL', claim: 'A Nordwind-szerződés nem mondható fel.',
      quote: 'azt nem lehet csak úgy felmondani', startMs: null, conflictingFactId: 'F1', conflictingSource: '',
      explanation: 'A szerződés 11.3 pontja tulajdonosváltáskor 30 napos felmondást enged – tranzakció esetén a bevétel harmada kerül kockázatba.',
      severity: 'HIGH',
    },
    {
      pillar: 'OPERATIONS', claim: 'Minden nagy beszállítóval van keretszerződés.',
      quote: 'Minden nagy beszállítóval keretszerződésünk van', startMs: null, conflictingFactId: 'F2', conflictingSource: '',
      explanation: 'Az Acél-Trade Kft.-vel (beszerzés 46%-a) nem került feltöltésre keretszerződés. Vagy hiányzik a dokumentum, vagy a szerződés.',
      severity: 'MEDIUM',
    },
    {
      pillar: 'LEGAL', claim: 'A szoftver a cég tulajdona.',
      quote: 'úgyhogy az a miénk', startMs: null, conflictingFactId: 'F3', conflictingSource: '',
      explanation: 'A megbízási szerződésekben nincs jogátruházás; a vagyoni jogok a fejlesztőknél maradhattak.',
      severity: 'HIGH',
    },
  ],
  followUpQuestions: [
    'Kérjük a Nordwind-szerződés összes módosítását és mellékletét.',
    'Létezik-e írásos megállapodás az Acél-Trade Kft.-vel (ár, mennyiség, szállítási garancia)?',
    'Hajlandók-e a fejlesztők utólagos jogátruházási nyilatkozatot aláírni, és milyen feltétellel?',
  ],
};
