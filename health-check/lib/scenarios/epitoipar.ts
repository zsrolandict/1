import { buildItems, sectorItem, type Scenario } from './types';

// KITALÁLT mintaeset – valós céget nem ábrázol.

const NOTES = `[00:00:20] Kérdező: Mennyire függnek egy-egy megrendelőtől?
[00:00:28] Ügyvezető: Szerintem nem nagyon. Van egy nagy önkormányzati partnerünk, de a munkáink legfeljebb ötöde jön tőlük.
[00:01:15] Kérdező: Hogyan dolgoznak az alvállalkozói brigádok?
[00:01:22] Ügyvezető: Ők a saját cégükkel számláznak, de gyakorlatilag csak nekünk dolgoznak, az előmunkásunk osztja be őket reggelente.
[00:02:30] Kérdező: Vannak késedelmes projektek?
[00:02:36] Ügyvezető: A sportcsarnok csúszik két hónapot, de a kötbér nálunk mindig maximálva van, erre figyelünk.
[00:03:40] Kérdező: Hogy állnak a kintlévőségekkel?
[00:03:46] Ügyvezető: Az önkormányzat lassan fizet, fél évet is várunk, emiatt folyószámlahitelt kellett felvennünk.
[00:04:30] Kérdező: Ki tartja a kapcsolatot a megrendelőkkel?
[00:04:36] Ügyvezető: Mindent én intézek, a tenderekre is én adom be az árajánlatot.`;

export const EPITOIPAR: Scenario = {
  id: 'epitoipar',
  label: 'Építőipari cég',
  sector: 'Építőipar – magas- és mélyépítés',
  situation: 'Bankgarancia-keret bővítése előtt a tulajdonos látni akarja, mit fog kérdezni a bank.',
  companyName: 'Példa Építőipari Kft.',
  sectors: ['CONSTRUCTION'],
  kind: 'FINANCING_READINESS',
  company: { revenueHuf: 3_800_000_000, grossMarginPct: 0.14, actualDsoDays: 94, industryDsoDays: 60 },
  materialityHuf: 80_000_000,
  items: buildItems(
    {
      'FIN-03': {
        identified: true, likelihood: 4, impact: 3, serviceFeeHuf: 600_000,
        description: 'A 90 napon túli követelések 420 M Ft-ot tesznek ki, zömük egy önkormányzati megrendelőnél.',
        reasoning: 'A vevőállomány átlagos futamideje jóval meghaladja az iparági szintet, a késedelmes követelések egyetlen közszférás megrendelőnél koncentrálódnak. A lekötött forgótőkét a társaság folyószámlahitelből finanszírozza, ami rontja a bank által vizsgált likviditási mutatókat és a garanciakeret-bővítés esélyét.',
      },
      'FIN-04': {
        identified: true, likelihood: 3, impact: 4, exposureHuf: 18_000_000,
        reasoning: 'Az építőipari fordított adózású ügyletek és az ÁFA-analitika között egyeztetetlen eltérés van. Adóellenőrzés esetén ez adókülönbözet és bírság kockázatát hordozza, és a könyvelési kontrollok gyengeségére utal.',
      },
      'OPS-01': {
        identified: true, likelihood: 3, impact: 3, exposureHuf: 60_000_000,
        description: 'Az acél- és betonbeszerzés 60%-a egy nagykereskedőtől jön, fix áras keretszerződés nélkül.',
      },
      'HR-01': {
        identified: true, likelihood: 4, impact: 4, serviceFeeHuf: 900_000,
        description: 'Az ajánlatadás és a megrendelői kapcsolatok teljes egészében az ügyvezetőnél vannak.',
        valuation: { formula: { type: 'REVENUE_SHARE', share: 0.25, marginBased: true, label: 'ügyvezetőhöz kötött tenderbevétel' }, overrideHuf: null },
      },
      'HR-02': {
        identified: true, likelihood: 4, impact: 4, exposureHuf: 25_000_000,
        description: 'Kizárólag a társaságnak dolgozó, napi utasítás alatt álló alvállalkozói brigádok.',
        reasoning: 'Az alvállalkozói brigádok tagjai évek óta kizárólag a társaságnak dolgoznak, munkájukat a társaság előmunkása naponta osztja be. Ellenőrzés esetén a jogviszony munkaviszonnyá minősíthető, ami visszamenőleges közteher- és járulékfizetési kötelezettséget, valamint munkavédelmi felelősséget von maga után.',
      },
    },
    [
      sectorItem({
        code: 'EPI-01', pillar: 'LEGAL', title: 'Plafon nélküli késedelmi kötbér futó projektekben',
        description: 'Két folyamatban lévő projektnél napi 0,5%-os, felső korlát nélküli kötbér.',
        likelihood: 4, impact: 4, exposureHuf: 120_000_000, remediationDays: 10,
        remediation: 'Kötbérplafon és vis maior-rendelkezés újratárgyalása; szerződésminta egységesítése.',
        division: 'LEGAL', serviceFeeHuf: 1_200_000,
        reasoning: 'Két futó projekt szerződése napi 0,5%-os, felső korlát nélküli késedelmi kötbért ír elő, miközben az egyik projekt már két hónapot csúszik. A kötbér így rövid idő alatt meghaladhatja a projekt fedezetét, és a bank a garanciakeret bírálatánál függő kötelezettségként veszi figyelembe.',
      }),
      sectorItem({
        code: 'EPI-02', pillar: 'OPERATIONS', title: 'Egyetlen közszférás megrendelőtől való függés',
        description: 'A 2025-ös árbevétel 45%-a egy önkormányzati megrendelőtől származik.',
        likelihood: 3, impact: 5, exposureHuf: 0, remediationDays: 60,
        remediation: 'Megrendelői portfólió bővítése magánszektorbeli keretszerződésekkel; tenderstratégia.',
        division: 'ADVISORY', serviceFeeHuf: 1_000_000,
        reasoning: 'Az árbevétel közel fele egyetlen önkormányzati megrendelőtől származik, amelynek beruházási üteme költségvetési és politikai döntésektől függ. Egy elmaradó vagy elhalasztott ütem a társaság kapacitásának jelentős részét hagyná kihasználatlanul.',
        valuation: { formula: { type: 'REVENUE_SHARE', share: 0.45, marginBased: true, label: 'közszférás megrendelő árbevétel-aránya' }, overrideHuf: null },
      }),
      sectorItem({
        code: 'EPI-03', pillar: 'FINANCE', title: 'Készültségi fok szerinti bevétel-elszámolás hiányosságai',
        description: 'A folyamatban lévő projektek bevétele számlázás szerint, nem készültségi fok alapján kerül elszámolásra.',
        likelihood: 3, impact: 3, exposureHuf: 40_000_000, remediationDays: 15,
        remediation: 'Projektkontrolling bevezetése, készültségi fok szerinti elszámolás és időbeli elhatárolás.',
        division: 'ACCOUNTING', serviceFeeHuf: 800_000,
        reasoning: 'A projektek bevétele számlázáskor jelenik meg, függetlenül a tényleges készültségtől. Emiatt az évek közötti eredmény torzul, a veszteséges projektek későn láthatók, és a bank által kért projektszintű fedezetkimutatás nem készíthető el megbízhatóan.',
      }),
      sectorItem({
        code: 'EPI-04', pillar: 'HR', title: 'Hiányos munkavédelmi dokumentáció',
        description: 'Nincs naprakész munkavédelmi kockázatértékelés; alvállalkozói oktatás nincs dokumentálva.',
        likelihood: 2, impact: 4, exposureHuf: 15_000_000, remediationDays: 5,
        remediation: 'Kockázatértékelés aktualizálása, alvállalkozói munkavédelmi oktatás dokumentálása.',
        division: 'HR', serviceFeeHuf: 400_000,
        reasoning: 'A munkavédelmi kockázatértékelés nem naprakész, és az alvállalkozói brigádok oktatása nincs dokumentálva. Munkabaleset esetén a társaság felelőssége és a hatósági bírság kockázata jelentősen nő, különösen a munkaviszonyba átminősíthető jogviszonyok miatt.',
      }),
    ],
  ),
  facts: [
    { id: 'F1', pillar: 'OPERATIONS', statement: 'A 2025-ös főkönyv szerint a legnagyobb (önkormányzati) megrendelő az árbevétel 45%-át adta.', source: 'Főkönyv 2025, vevőanalitika' },
    { id: 'F2', pillar: 'HR', statement: 'Hat alvállalkozói szerződésnél hiányzik a teljesítésigazolás, a brigádok 3 éve kizárólag a társaságnak dolgoznak.', source: 'Alvállalkozói szerződések (14 db), AI-előszűrés' },
    { id: 'F3', pillar: 'FINANCE', statement: 'A 90 napon túli vevőkövetelések állománya 420 M Ft, ebből 310 M Ft egyetlen megrendelőtől.', source: 'Korosított vevőlista, 2026. 06. 30.' },
    { id: 'F4', pillar: 'LEGAL', statement: 'Két folyamatban lévő projekt szerződése napi 0,5%-os, felső korlát nélküli késedelmi kötbért ír elő.', source: 'Vállalkozási szerződések #3 (9.4 pont) és #5 (11.2 pont)' },
  ],
  missingDocuments: [
    { title: 'Bankgarancia-keretszerződés és kovenánsok', pillar: 'FINANCE' },
    { title: 'Munkavédelmi kockázatértékelés', pillar: 'HR' },
  ],
  interview: {
    role: 'OWNER_CEO',
    notes: NOTES,
    analysis: {
      summary:
        'Az ügyvezető alulbecsüli a legnagyobb megrendelőtől való függést (ötödöt említ, a főkönyv szerint 45%), és úgy tudja, hogy a kötbérek maximálva vannak, miközben két futó szerződésben nincs kötbérplafon, az egyik projekt pedig már két hónapot csúszik. Az alvállalkozói brigádok napi beosztása munkaviszony jellegre utal. A kintlévőségek miatt folyószámlahitelt vettek fel, ami a garanciakeret-bővítésnél kulcskérdés lesz. Az ajánlatadás és a megrendelői kapcsolatok kizárólag az ügyvezetőnél vannak.',
      statements: [
        { pillar: 'FINANCE', summary: 'Az önkormányzat késedelmes fizetése miatt folyószámlahitel kellett.', quote: 'emiatt folyószámlahitelt kellett felvennünk', speaker: '', startMs: null },
        { pillar: 'OPERATIONS', summary: 'A sportcsarnok-projekt két hónapot csúszik.', quote: 'A sportcsarnok csúszik két hónapot', speaker: '', startMs: null },
        { pillar: 'HR', summary: 'Az ajánlatadás és a megrendelői kapcsolat egy kézben van.', quote: 'a tenderekre is én adom be az árajánlatot', speaker: '', startMs: null },
      ],
      suggestedRedFlags: [
        { templateCode: 'HR-02', pillar: 'HR', title: 'Színlelt vállalkozói jogviszonyok', rationale: 'A brigádokat a társaság előmunkása osztja be naponta, kizárólag a társaságnak dolgoznak.', quote: 'az előmunkásunk osztja be őket reggelente', startMs: null, likelihood: 4, impact: 4, exposureHufEstimate: null, confidence: 0.9 },
        { templateCode: 'HR-01', pillar: 'HR', title: 'Kulcsember-függőség (HR 361)', rationale: 'Minden megrendelői kapcsolat és ajánlat az ügyvezetőn keresztül fut.', quote: 'Mindent én intézek, a tenderekre is én adom be az árajánlatot', startMs: null, likelihood: 4, impact: 4, exposureHufEstimate: null, confidence: 0.85 },
        { templateCode: 'FIN-03', pillar: 'FINANCE', title: 'Lejárt vevőállomány koncentrációja', rationale: 'Féléves fizetési késedelem, hitelből finanszírozott forgótőke.', quote: 'fél évet is várunk, emiatt folyószámlahitelt kellett felvennünk', startMs: null, likelihood: 4, impact: 3, exposureHufEstimate: null, confidence: 0.85 },
      ],
      contradictions: [
        { pillar: 'OPERATIONS', claim: 'A nagy megrendelő a munkák legfeljebb ötödét adja.', quote: 'a munkáink legfeljebb ötöde jön tőlük', startMs: null, conflictingFactId: 'F1', conflictingSource: '', explanation: 'A főkönyv szerint a részesedés 45%, több mint kétszerese az ügyvezető becslésének. A függőség a bank kockázati besorolását közvetlenül érinti.', severity: 'HIGH' },
        { pillar: 'LEGAL', claim: 'A kötbér mindig maximálva van.', quote: 'a kötbér nálunk mindig maximálva van', startMs: null, conflictingFactId: 'F4', conflictingSource: '', explanation: 'Két futó szerződésben nincs kötbérplafon, és az egyik érintett projekt már csúszik. A vezetés nincs tisztában a legnagyobb függő kötelezettséggel.', severity: 'HIGH' },
      ],
      followUpQuestions: [
        'Kérjük a sportcsarnok-projekt aktuális ütemtervét és a megrendelővel folytatott levelezést a csúszásról.',
        'Van-e írásos megállapodás a legnagyobb megrendelővel a fizetési határidőkről?',
        'Hány fő dolgozik a brigádokban, és mióta kizárólag a társaságnak?',
      ],
    },
  },
};
