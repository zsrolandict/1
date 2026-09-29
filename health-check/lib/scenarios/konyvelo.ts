import { buildItems, sectorItem, type Scenario } from './types';

// KITALÁLT mintaeset – valós céget nem ábrázol.

const NOTES = `[00:00:18] Kérdező: Ki viszi tovább az irodát, ha Ön visszavonul?
[00:00:25] Alapító: A lányom és a helyettesem, de még nem beszéltük meg pontosan, ki mennyit kap az üzletrészből.
[00:01:10] Kérdező: A nagy ügyfelek kihez kötődnek?
[00:01:16] Alapító: A régi ügyfelek jó része engem hív, ha gond van, velük harminc éve dolgozom.
[00:02:05] Kérdező: Mikor emeltek utoljára díjat?
[00:02:11] Alapító: Minden évben emelünk az infláció szerint, ez benne van a szerződéseinkben.
[00:03:00] Kérdező: Mi történik, ha leáll a szerver?
[00:03:06] Alapító: Minden éjjel mentünk, és tavaly vissza is állítottuk egyszer, gond nélkül ment.
[00:04:02] Kérdező: Mekkora összegre szól a felelősségbiztosítás?
[00:04:08] Alapító: Pontosan nem tudom, de biztos elég, még sosem volt kárunk.`;

export const KONYVELO: Scenario = {
  id: 'konyvelo',
  label: 'Könyvelőiroda',
  sector: 'Könyvelés, bérszámfejtés, adótanácsadás',
  situation: 'Az alapító 3 éven belül visszavonulna; a család és a helyettes közötti átadást kell előkészíteni.',
  companyName: 'Példa Könyvelő Iroda Kft.',
  sectors: ['ACCOUNTING'],
  kind: 'SUCCESSION',
  company: { revenueHuf: 1_200_000_000, grossMarginPct: 0.32, actualDsoDays: 48, industryDsoDays: 30 },
  materialityHuf: 25_000_000,
  items: buildItems(
    {
      'HR-01': {
        identified: true,
        likelihood: 4,
        impact: 5,
        description: 'A régi, nagy ügyfelek személyesen az alapítóhoz kötődnek.',
        reasoning:
          'Az iroda legnagyobb és legrégebbi ügyfelei személyesen az alapítóhoz kötődnek, az ügyfélkapcsolat átadása nem kezdődött el. Az alapító visszavonulásakor ezek az ügyfelek jelentős valószínűséggel más könyvelőt választanak, ami közvetlenül csökkenti a cég értékét és az utódok által átvehető bevételt.',
        valuation: { formula: { type: 'REVENUE_SHARE', share: 0.35, marginBased: true, label: 'alapítóhoz kötött ügyfelek árbevétele' }, overrideHuf: null },
      },
      'LEG-04': {
        identified: true,
        likelihood: 3,
        impact: 4,
        exposureHuf: 20_000_000,
        description: 'Bér- és személyes adatok kezelése adatkezelési nyilvántartás nélkül.',
        reasoning:
          'Az iroda több száz munkavállaló bér- és személyes adatát kezeli ügyfelei megbízásából, adatkezelési nyilvántartás és adatfeldolgozói szerződések nélkül. Egy adatvédelmi incidens hatósági bírságot és az ügyfélbizalom elvesztését vonhatja maga után.',
      },
      'OPS-02': { identified: true, likelihood: 3, impact: 3, exposureHuf: 15_000_000 },
      'OPS-03': {
        identified: true,
        likelihood: 3,
        impact: 4,
        exposureHuf: 20_000_000,
        description: 'Helyi szerver, az utolsó igazolt visszaállítási teszt 2023-ban volt.',
      },
      'HR-04': { identified: true, likelihood: 4, impact: 3, exposureHuf: 12_000_000 },
      'LEG-03': { identified: true, likelihood: 3, impact: 2, exposureHuf: 1_000_000 },
      'FIN-03': { identified: true, likelihood: 2, impact: 3 },
    },
    [
      sectorItem({
        code: 'KON-01',
        pillar: 'LEGAL',
        title: 'Alulbiztosított szakmai felelősség',
        description: 'A felelősségbiztosítás limitje 10 M Ft/év; a vezetés nem ismeri a fedezet mértékét.',
        likelihood: 3,
        impact: 4,
        exposureHuf: 30_000_000,
        remediationDays: 5,
        remediation: 'Fedezet felülvizsgálata és emelése; ügyfélszerződésekben felelősségkorlátozás.',
        division: 'LEGAL',
        serviceFeeHuf: 350_000,
        reasoning:
          'Egy hibás bevallásból vagy bérszámfejtésből eredő ügyfélkár nagyobb ügyfélnél könnyen meghaladja a 10 M Ft-os éves biztosítási limitet. A különbözetet az iroda saját vagyonából kellene megtérítenie, ami átadás előtt a vételárat és az utódok kockázatát is érinti.',
      }),
      sectorItem({
        code: 'KON-02',
        pillar: 'LEGAL',
        title: 'Hiányos pénzmosás elleni belső szabályzat és ügyfél-átvilágítás',
        description: 'Nincs aktuális belső szabályzat; az ügyfél-átvilágítások dokumentációja hiányos.',
        likelihood: 3,
        impact: 3,
        exposureHuf: 8_000_000,
        remediationDays: 5,
        remediation: 'Belső szabályzat aktualizálása, ügyfél-átvilágítások pótlása, munkatársi oktatás.',
        division: 'LEGAL',
        serviceFeeHuf: 400_000,
        reasoning:
          'A könyvelő irodákra vonatkozó pénzmosás elleni kötelezettségek teljesítése nem dokumentált: a belső szabályzat nem aktuális, az ügyfél-átvilágítások hiányosak. Felügyeleti ellenőrzés esetén bírság és a szakmai hírnév sérülése a kockázat.',
      }),
      sectorItem({
        code: 'KON-03',
        pillar: 'FINANCE',
        title: 'Indexálás nélküli fix havidíjas szerződések',
        description: 'Az ügyfélszerződések 70%-a 2019 előtti, díjemelési záradék nélkül.',
        likelihood: 4,
        impact: 3,
        exposureHuf: 36_000_000,
        remediationDays: 20,
        remediation: 'Díjszabás felülvizsgálata, indexálási záradék bevezetése, ügyfélkommunikációs terv.',
        division: 'ADVISORY',
        serviceFeeHuf: 600_000,
        reasoning:
          'Az ügyfélszerződések többsége évek óta változatlan havidíjjal fut, díjemelési záradék nélkül, miközben a bérköltségek jelentősen nőttek. A fedezet évről évre csökken, és az egyoldalú díjemelés szerződésmódosítás nélkül nem érvényesíthető.',
      }),
      sectorItem({
        code: 'KON-04',
        pillar: 'LEGAL',
        title: 'Rendezetlen tulajdonosi utódlás',
        description: 'Nincs megállapodás az üzletrész átadásáról; a társasági szerződés nem rendezi az átruházást.',
        likelihood: 4,
        impact: 4,
        exposureHuf: 60_000_000,
        remediationDays: 30,
        remediation: 'Utódlási megállapodás, társasági szerződés módosítása (elővásárlás, átruházás, kilépés), értékelés.',
        division: 'LEGAL',
        serviceFeeHuf: 1_500_000,
        reasoning:
          'Az alapító és a két kijelölt utód között nincs megállapodás az üzletrészek arányáról és az átadás ütemezéséről, a társasági szerződés pedig nem tartalmaz átruházási és elővásárlási szabályokat. Vita vagy váratlan kiesés esetén a működés és az ügyfélkör megtartása egyaránt veszélybe kerül.',
      }),
    ],
  ),
  facts: [
    {
      id: 'F1',
      pillar: 'FINANCE',
      statement: 'Az ügyfélszerződések 70%-a 2019 előtti, díjemelési (indexálási) záradék nélkül.',
      source: 'Ügyfélszerződések (148 db), AI-előszűrés',
    },
    { id: 'F2', pillar: 'LEGAL', statement: 'A szakmai felelősségbiztosítás kárösszeg-limitje 10 M Ft/év.', source: 'Biztosítási kötvény, 2. oldal' },
    {
      id: 'F3',
      pillar: 'OPERATIONS',
      statement: 'Az informatikai jegyzőkönyvek szerint az utolsó sikeres mentés-visszaállítási teszt 2023-ban volt.',
      source: 'IT-üzemeltetési napló',
    },
    {
      id: 'F4',
      pillar: 'LEGAL',
      statement: 'A társasági szerződés nem tartalmaz elővásárlási és üzletrész-átruházási szabályt a tagok között.',
      source: 'Társasági szerződés (2014), 6. pont',
    },
  ],
  missingDocuments: [
    { title: 'Adatkezelési nyilvántartás', pillar: 'LEGAL' },
    { title: 'Pénzmosás elleni belső szabályzat', pillar: 'LEGAL' },
  ],
  interview: {
    role: 'OWNER_CEO',
    notes: NOTES,
    analysis: {
      summary:
        'Az utódlás elvi szinten eldőlt (lány és helyettes), de az üzletrészek megosztásáról nincs megállapodás, és a társasági szerződés sem rendezi az átruházást. A régi ügyfelek az alapítóhoz kötődnek. Az alapító szerint a szerződésekben van inflációs díjemelés, a dokumentumok szerint a szerződések 70%-ában nincs. A mentés visszaállítását az alapító tavalyinak mondja, a napló szerint 2023-as volt. A felelősségbiztosítás összegét nem ismeri.',
      statements: [
        {
          pillar: 'LEGAL',
          summary: 'Az utódok köre kijelölt, a részesedés nem.',
          quote: 'még nem beszéltük meg pontosan, ki mennyit kap az üzletrészből',
          speaker: '',
          startMs: null,
        },
        { pillar: 'HR', summary: 'A régi ügyfelek az alapítót keresik.', quote: 'A régi ügyfelek jó része engem hív, ha gond van', speaker: '', startMs: null },
        { pillar: 'OPERATIONS', summary: 'Éjszakai mentés van.', quote: 'Minden éjjel mentünk', speaker: '', startMs: null },
      ],
      suggestedRedFlags: [
        {
          templateCode: 'HR-01',
          pillar: 'HR',
          title: 'Kulcsember-függőség (HR 361)',
          rationale: 'A régi, nagy ügyfelek az alapítóhoz kötődnek, átadás nem kezdődött.',
          quote: 'A régi ügyfelek jó része engem hív, ha gond van, velük harminc éve dolgozom',
          startMs: null,
          likelihood: 4,
          impact: 5,
          exposureHufEstimate: null,
          confidence: 0.9,
        },
        {
          templateCode: 'KON-04',
          pillar: 'LEGAL',
          title: 'Rendezetlen tulajdonosi utódlás',
          rationale: 'Az üzletrészek megosztásáról nincs megállapodás.',
          quote: 'még nem beszéltük meg pontosan, ki mennyit kap az üzletrészből',
          startMs: null,
          likelihood: 4,
          impact: 4,
          exposureHufEstimate: null,
          confidence: 0.9,
        },
        {
          templateCode: 'KON-01',
          pillar: 'LEGAL',
          title: 'Alulbiztosított szakmai felelősség',
          rationale: 'A vezetés nem ismeri a biztosítási fedezetet.',
          quote: 'Pontosan nem tudom, de biztos elég',
          startMs: null,
          likelihood: 3,
          impact: 4,
          exposureHufEstimate: null,
          confidence: 0.75,
        },
      ],
      contradictions: [
        {
          pillar: 'FINANCE',
          claim: 'A szerződésekben benne van az inflációs díjemelés.',
          quote: 'Minden évben emelünk az infláció szerint, ez benne van a szerződéseinkben',
          startMs: null,
          conflictingFactId: 'F1',
          conflictingSource: '',
          explanation: 'A szerződések 70%-ában nincs indexálási záradék; a díjemelés ezeknél csak megállapodással érvényesíthető.',
          severity: 'HIGH',
        },
        {
          pillar: 'OPERATIONS',
          claim: 'Tavaly sikeres visszaállítás volt.',
          quote: 'tavaly vissza is állítottuk egyszer, gond nélkül ment',
          startMs: null,
          conflictingFactId: 'F3',
          conflictingSource: '',
          explanation: 'A napló szerint az utolsó igazolt visszaállítási teszt 2023-as. Vagy a teszt nincs dokumentálva, vagy nem történt meg.',
          severity: 'MEDIUM',
        },
      ],
      followUpQuestions: [
        'Milyen arányban és ütemezésben képzeli az üzletrészek átadását a két utód között?',
        'Melyik 20 ügyfél kapcsolatát kell elsőként átadni, és ki veszi át?',
        'Kérjük a tavalyi visszaállítás dokumentációját, ha van.',
      ],
    },
  },
};
