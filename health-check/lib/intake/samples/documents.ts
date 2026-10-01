import { redactPages } from '../documents/redact';
import type { DocumentFormat, DocumentPage, DocumentRecord, RawDocumentAnalysis } from '../documents/types';
import { verifyDocumentAnalysis } from '../documents/verify';
import { financialSampleDocuments } from './financialDocs';

/**
 * KITALÁLT mintadokumentumok (szerződésrészletek) és előre elkészített
 * elemzésük a mintaesetekhez. Valós céget, személyt nem ábrázolnak.
 * Az elemzés NEM élő AI-hívás, de ugyanazon a maszkoláson és
 * idézet-ellenőrzésen megy át, mint egy valódi eredmény.
 */

export interface SampleDocument {
  fileName: string;
  format: DocumentFormat;
  pages: DocumentPage[];
  analysis: RawDocumentAnalysis;
}

const page = (n: number, text: string): DocumentPage => ({ label: `${n}. oldal`, text });
const section = (n: number, text: string): DocumentPage => ({ label: `${n}. szakasz`, text });

const GYARTO_KERET: SampleDocument = {
  fileName: 'Keretszerzodes_Pelda_Autoipari.pdf',
  format: 'PDF',
  pages: [
    page(
      1,
      `SZÁLLÍTÁSI KERETSZERZŐDÉS
amely létrejött egyrészről a Példa Autóipari Beszállító Zrt. (a továbbiakban: Megrendelő), másrészről a Minta Gyártó Kft. (a továbbiakban: Szállító) között az alábbi feltételekkel.
1. A szerződés tárgya
1.1 Szállító a Megrendelő eseti megrendelései alapján préselt és hegesztett acél alkatrészeket gyárt és szállít.
2. A szerződés hatálya
2.1 A szerződés határozatlan időre jön létre.
2.2 Bármelyik fél a szerződést 90 napos felmondási idővel, indokolás nélkül, írásban felmondhatja.`,
    ),
    page(
      2,
      `11. Kötbér
11.1 Késedelmes szállítás esetén a Szállító késedelmi kötbért fizet, amelynek mértéke a késedelmes rendelés nettó értékének napi 0,5%-a, legfeljebb a rendelés nettó értékének 20%-a.
14. Tulajdonosi változás
14.2 Amennyiben a Szállító tulajdonosi szerkezetében olyan változás következik be, amelynek eredményeként harmadik személy a Szállítóban közvetlenül vagy közvetetten 50%-ot meghaladó befolyást szerez, a Megrendelő jogosult a szerződést azonnali hatállyal, kártérítési kötelezettség nélkül felmondani.
14.3 A Szállító a tulajdonosi szerkezet változásáról a változást követő 15 napon belül köteles a Megrendelőt írásban értesíteni.`,
    ),
    page(
      3,
      `16. Kizárólagosság
16.1 A Szállító a szerződés hatálya alatt és annak megszűnését követő 12 hónapig a Megrendelő által megjelölt versenytársak részére azonos termékkört nem gyárthat és nem szállíthat.
18. Kapcsolattartók
Megrendelő részéről: beszerzési vezető, tel.: +36 30 123 4567, e-mail: beszerzes@pelda-autoipari.example
Szállító részéről: ügyvezető, tel.: +36 20 765 4321, e-mail: ugyvezeto@minta-gyarto.example
Kelt: Győr, 2021. március 1.`,
    ),
  ],
  analysis: {
    documentType: 'Vevői szállítási keretszerződés',
    summary:
      'Határozatlan idejű szállítási keretszerződés a társaság egyik legnagyobb vevőjével, préselt és hegesztett acél alkatrészek gyártására. A vevő 90 napos határidővel indokolás nélkül felmondhat, tulajdonosváltáskor pedig azonnali hatállyal. A késedelmi kötbér a rendelés értékének 20%-ában korlátozott; a társaságot a szerződés megszűnése után 12 hónapig kizárólagossági kötelezettség terheli.',
    findings: [
      {
        templateCode: 'LEG-01',
        pillar: 'LEGAL',
        title: 'Change of Control záradék kulcsszerződésben',
        rationale:
          'Eladás esetén a vevő azonnali hatállyal, kártérítés nélkül kiléphet. Az eladói átvilágításban ez az egyik első kérdés lesz, és a vevő waiver hiányában vételár-visszatartással él.',
        quote:
          'harmadik személy a Szállítóban közvetlenül vagy közvetetten 50%-ot meghaladó befolyást szerez, a Megrendelő jogosult a szerződést azonnali hatállyal, kártérítési kötelezettség nélkül felmondani',
        pageIndex: null,
        likelihood: 4,
        impact: 5,
        exposureHufEstimate: null,
        confidence: 0.93,
      },
      {
        templateCode: null,
        pillar: 'LEGAL',
        title: 'Szerződés utáni kizárólagossági kötelezettség a kulcsvevő felé',
        rationale:
          'A kizárólagosság a szerződés megszűnése után 12 hónapig korlátozza az értékesítést a vevő versenytársai felé, így a vevő elvesztése esetén a kiesés pótlása is nehezebb.',
        quote: 'annak megszűnését követő 12 hónapig a Megrendelő által megjelölt versenytársak részére azonos termékkört nem gyárthat és nem szállíthat',
        pageIndex: null,
        likelihood: 3,
        impact: 3,
        exposureHufEstimate: null,
        confidence: 0.72,
      },
      {
        // Szándékosan kitalált idézet: az ellenőrzés kiszűri (így néz ki a hallucináció elleni védelem).
        templateCode: null,
        pillar: 'FINANCE',
        title: 'Engedményezési tilalom',
        rationale: 'A követelések faktorálása nem lehetséges.',
        quote: 'Szállító a szerződésből eredő követeléseit harmadik személyre nem engedményezheti',
        pageIndex: null,
        likelihood: 2,
        impact: 2,
        exposureHufEstimate: null,
        confidence: 0.4,
      },
    ],
    facts: [
      {
        pillar: 'LEGAL',
        statement: 'A kulcsvevői keretszerződés tulajdonosváltáskor azonnali, kártérítés nélküli felmondást enged (14.2 pont).',
        quote: 'a Megrendelő jogosult a szerződést azonnali hatállyal, kártérítési kötelezettség nélkül felmondani',
        pageIndex: null,
      },
      {
        pillar: 'LEGAL',
        statement: 'A keretszerződés 90 napos felmondási idővel, indokolás nélkül is felmondható.',
        quote: 'Bármelyik fél a szerződést 90 napos felmondási idővel, indokolás nélkül, írásban felmondhatja',
        pageIndex: null,
      },
      {
        pillar: 'LEGAL',
        statement: 'A késedelmi kötbér napi 0,5%, legfeljebb a rendelés értékének 20%-a.',
        quote: 'napi 0,5%-a, legfeljebb a rendelés nettó értékének 20%-a',
        pageIndex: null,
      },
    ],
    missingProvisions: ['Felelősségkorlátozás (kártérítési plafon)', 'Árkorrekciós / indexálási mechanizmus az acélár változására'],
  },
};

const GYARTO_MEGBIZASI: SampleDocument = {
  fileName: 'Megbizasi_szerzodes_Pelda_Fejleszto_Bt.docx',
  format: 'DOCX',
  pages: [
    section(
      1,
      `MEGBÍZÁSI SZERZŐDÉS
Megbízó: Minta Gyártó Kft.
Megbízott: Példa Fejlesztő Bt., képviseli az ügyvezető, adóazonosító jel: 8123456789, bankszámla: 11700000-22222222-33333333
1. A megbízás tárgya: a Megbízó gyártásirányítási rendszerének (MES) fejlesztése és üzemeltetése.
2. A Megbízott a feladatokat a Megbízó telephelyén, a Megbízó által meghatározott munkarendben, a Megbízó eszközeivel látja el.
3. Megbízási díj: havi 1 450 000 Ft + ÁFA, a teljesítéstől függetlenül.`,
    ),
    section(
      2,
      `5. Szellemi tulajdon
5.1 A Megbízott által készített szoftver forráskódjára a Megbízót nem kizárólagos, határozatlan idejű felhasználási jog illeti meg.
5.2 A szerzői vagyoni jogok a Megbízottnál maradnak; a Megbízott a szoftvert harmadik személyek részére is hasznosíthatja.
7. A szerződés határozatlan időre jön létre, 30 napos felmondási idővel.`,
    ),
  ],
  analysis: {
    documentType: 'Szoftverfejlesztési megbízási szerződés',
    summary:
      'Határozatlan idejű megbízás a gyártásirányítási rendszer (MES) fejlesztésére és üzemeltetésére, fix havidíjjal. A szerzői vagyoni jogok a fejlesztőnél maradnak, a társaság csak nem kizárólagos felhasználási jogot kapott. A megbízott a társaság telephelyén, annak munkarendjében és eszközeivel dolgozik.',
    findings: [
      {
        templateCode: 'LEG-02',
        pillar: 'LEGAL',
        title: 'Hiányzó IP-átruházás (fejlesztők, alvállalkozók)',
        rationale:
          'A gyártást irányító szoftver jogai nem a társaságé, és a fejlesztő versenytársaknak is átadhatja. Eladásnál a vevő a kulcsrendszer jogcímét hiányolni fogja.',
        quote: 'A szerzői vagyoni jogok a Megbízottnál maradnak; a Megbízott a szoftvert harmadik személyek részére is hasznosíthatja',
        pageIndex: null,
        likelihood: 4,
        impact: 4,
        exposureHufEstimate: null,
        confidence: 0.94,
      },
      {
        templateCode: 'HR-02',
        pillar: 'HR',
        title: 'Színlelt vállalkozói jogviszonyok',
        rationale:
          'A telephelyi munkavégzés, a megbízó munkarendje és eszközei, valamint a teljesítéstől független havidíj munkaviszonyra utaló jegyek. Egyszemélyes Bt. esetén az átminősítés kockázata valós.',
        quote: 'a Megbízó telephelyén, a Megbízó által meghatározott munkarendben, a Megbízó eszközeivel látja el',
        pageIndex: null,
        likelihood: 3,
        impact: 3,
        exposureHufEstimate: null,
        confidence: 0.6,
      },
    ],
    facts: [
      {
        pillar: 'LEGAL',
        statement: 'A MES-szoftver szerzői vagyoni jogai a fejlesztőnél maradtak, a társaság csak nem kizárólagos felhasználási jogot kapott.',
        quote: 'A Megbízott által készített szoftver forráskódjára a Megbízót nem kizárólagos, határozatlan idejű felhasználási jog illeti meg',
        pageIndex: null,
      },
      {
        pillar: 'OPERATIONS',
        statement: 'A gyártásirányítási rendszer fejlesztése és üzemeltetése egy külső Bt.-n múlik, 30 napos felmondási idővel.',
        quote: 'A szerződés határozatlan időre jön létre, 30 napos felmondási idővel',
        pageIndex: null,
      },
    ],
    missingProvisions: ['Forráskód-letét (escrow)', 'Titoktartás és versenytilalom'],
  },
};

const EPITO_VALLALKOZASI: SampleDocument = {
  fileName: 'Vallalkozasi_szerzodes_Sportcsarnok.pdf',
  format: 'PDF',
  pages: [
    page(
      1,
      `VÁLLALKOZÁSI SZERZŐDÉS
Megrendelő: Példa Város Önkormányzata
Vállalkozó: Példa Építőipari Kft.
1. Tárgy: városi sportcsarnok generálkivitelezése a kiviteli tervdokumentáció szerint.
2. Vállalkozói díj: nettó 1 240 000 000 Ft.
3. Teljesítési határidő: 2026. április 30.
6. Fizetés: a számlák kiegyenlítése a teljesítésigazolást követő 60 napon belül történik.`,
    ),
    page(
      2,
      `7.2 Alvállalkozó igénybevételéhez a Megrendelő előzetes írásbeli hozzájárulása szükséges.
9. Kötbér
9.3 Késedelmes teljesítés esetén a Vállalkozó késedelmi kötbért fizet, amelynek mértéke a nettó vállalkozói díj 0,5%-a minden késedelmes naptári napra. A kötbér összege nincs korlátozva, és nem zárja ki a kötbért meghaladó kár érvényesítését.
12. Biztosítékok: jóteljesítési garancia a nettó vállalkozói díj 5%-ának megfelelő összegben.`,
    ),
  ],
  analysis: {
    documentType: 'Közbeszerzési vállalkozási szerződés (generálkivitelezés)',
    summary:
      'Nettó 1,24 Mrd Ft értékű generálkivitelezési szerződés egy önkormányzati sportcsarnokra, 2026. április 30-i határidővel. A késedelmi kötbér napi 0,5%, felső korlát nélkül, és a kötbért meghaladó kár is érvényesíthető. A fizetési határidő 60 nap, alvállalkozó csak előzetes hozzájárulással vehető igénybe.',
    findings: [
      {
        templateCode: 'EPI-01',
        pillar: 'LEGAL',
        title: 'Plafon nélküli késedelmi kötbér futó projektekben',
        rationale:
          'A projekt már késésben van: napi 0,5% mellett a kötbér havonta a díj mintegy 15%-ával nő, felső korlát nélkül. Ez a bank számára függő kötelezettség.',
        quote: 'a nettó vállalkozói díj 0,5%-a minden késedelmes naptári napra. A kötbér összege nincs korlátozva',
        pageIndex: null,
        likelihood: 5,
        impact: 4,
        exposureHufEstimate: 186_000_000,
        confidence: 0.9,
      },
    ],
    facts: [
      {
        pillar: 'LEGAL',
        statement: 'A sportcsarnok-szerződésben a késedelmi kötbér napi 0,5%, és nincs felső korlátja.',
        quote: 'A kötbér összege nincs korlátozva, és nem zárja ki a kötbért meghaladó kár érvényesítését',
        pageIndex: null,
      },
      {
        pillar: 'OPERATIONS',
        statement: 'Alvállalkozó csak a megrendelő előzetes írásbeli hozzájárulásával vehető igénybe.',
        quote: 'Alvállalkozó igénybevételéhez a Megrendelő előzetes írásbeli hozzájárulása szükséges',
        pageIndex: null,
      },
    ],
    missingProvisions: ['Kötbérplafon', 'Vis maior és pótmunka-elszámolás részletes szabályai'],
  },
};

const KONYVELO_KERET: SampleDocument = {
  fileName: 'Konyvelesi_megbizasi_szerzodes_minta.docx',
  format: 'DOCX',
  pages: [
    section(
      1,
      `KÖNYVELÉSI MEGBÍZÁSI SZERZŐDÉS (ügyfélszerződés-minta, 2017)
1. A Megbízott vállalja a Megbízó könyvvezetését, bérszámfejtését és adóbevallásainak elkészítését.
4. Megbízási díj
4.1 A megbízási díj havi 180 000 Ft + ÁFA, amely a szerződés hatálya alatt nem változik.
6. Felelősség
6.1 A Megbízott a szerződésszegéssel okozott kárért a tárgyévben kifizetett megbízási díj összegéig felel.
8. A szerződés határozatlan időre jön létre, bármelyik fél 60 napos felmondási idővel felmondhatja.`,
    ),
  ],
  analysis: {
    documentType: 'Könyvelési ügyfélszerződés (minta)',
    summary:
      'A 2017-es ügyfélszerződés-minta fix havidíjat rögzít, és kimondja, hogy a díj a szerződés hatálya alatt nem változik. A felelősség a tárgyévi díjig korlátozott, a szerződés 60 napos határidővel felmondható.',
    findings: [
      {
        templateCode: 'KON-03',
        pillar: 'FINANCE',
        title: 'Indexálás nélküli fix havidíjas szerződések',
        rationale:
          'A díj a szerződés hatálya alatt nem emelhető, így a bérköltség növekedése közvetlenül a fedezetet csökkenti. Az utódlásnál az átvevők egy romló jövedelmezőségű ügyfélállományt kapnak.',
        quote: 'A megbízási díj havi 180 000 Ft + ÁFA, amely a szerződés hatálya alatt nem változik',
        pageIndex: null,
        likelihood: 4,
        impact: 3,
        exposureHufEstimate: null,
        confidence: 0.91,
      },
    ],
    facts: [
      {
        pillar: 'FINANCE',
        statement: 'Az ügyfélszerződés-minta szerint a havidíj a szerződés hatálya alatt nem változik (nincs indexálás).',
        quote: 'amely a szerződés hatálya alatt nem változik',
        pageIndex: null,
      },
      {
        pillar: 'LEGAL',
        statement: 'Az iroda felelőssége a tárgyévben kifizetett megbízási díj összegéig korlátozott.',
        quote: 'a szerződésszegéssel okozott kárért a tárgyévben kifizetett megbízási díj összegéig felel',
        pageIndex: null,
      },
    ],
    missingProvisions: ['Díjemelési (indexálási) záradék', 'Adatfeldolgozói megállapodás (a GDPR szerinti 28. cikk)'],
  },
};

const IT_KERET: SampleDocument = {
  fileName: 'Szoftverfejlesztesi_keretszerzodes_Pelda_Bank.pdf',
  format: 'PDF',
  pages: [
    page(
      1,
      `SZOFTVERFEJLESZTÉSI ÉS TÁMOGATÁSI KERETSZERZŐDÉS
Megrendelő: Példa Bank Zrt.
Szállító: Példa Szoftverház Kft.
3. A Szállító a Megrendelő ügyfélportáljának fejlesztését és 7×24 órás támogatását végzi.
5. Szolgáltatási szint: a havi rendelkezésre állás legalább 99,9%. Minden megkezdett óra kiesés után a Szállító a havi szolgáltatási díj 5%-ának megfelelő kötbért fizet.`,
    ),
    page(
      2,
      `12. Felelősség
12.1 A Szállító a szerződésszegéssel okozott kárért a Polgári Törvénykönyv szabályai szerint, korlátozás nélkül felel.
15. A szerződés megszűnése
15.4 A Megrendelő jogosult a szerződést azonnali hatállyal felmondani, ha a Szállító feletti irányítás megváltozik, vagy a Szállító tulajdonosi körébe a Megrendelő versenytársa lép be.`,
    ),
  ],
  analysis: {
    documentType: 'Szoftverfejlesztési és támogatási keretszerződés',
    summary:
      'Keretszerződés a legnagyobb ügyféllel egy ügyfélportál fejlesztésére és 7×24 órás támogatására. Szigorú, 99,9%-os rendelkezésre állást és óránként 5%-os kötbért rögzít, a szállító felelőssége korlátlan. Irányításváltozáskor az ügyfél azonnali hatállyal felmondhat.',
    findings: [
      {
        templateCode: 'LEG-01',
        pillar: 'LEGAL',
        title: 'Change of Control záradék kulcsszerződésben',
        rationale:
          'A befektető belépése irányításváltozásnak minősülhet, és a bevétel felét adó ügyfél azonnal kiléphet. Ez ellentmond annak, hogy a szerződésből „nem tudnak csak úgy kilépni”.',
        quote: 'jogosult a szerződést azonnali hatállyal felmondani, ha a Szállító feletti irányítás megváltozik',
        pageIndex: null,
        likelihood: 4,
        impact: 5,
        exposureHufEstimate: null,
        confidence: 0.95,
      },
      {
        templateCode: 'ITF-02',
        pillar: 'LEGAL',
        title: 'Korlátlan felelősség és SLA-kötbér az ügyfélszerződésekben',
        rationale: 'Korlátlan kártérítési felelősség egy bankügyfél felé, óránként 5%-os SLA-kötbérrel: egy nagyobb kiesés a havi díj többszörösét viheti el.',
        quote: 'a szerződésszegéssel okozott kárért a Polgári Törvénykönyv szabályai szerint, korlátozás nélkül felel',
        pageIndex: null,
        likelihood: 3,
        impact: 5,
        exposureHufEstimate: null,
        confidence: 0.88,
      },
    ],
    facts: [
      {
        pillar: 'LEGAL',
        statement: 'A legnagyobb ügyfél irányításváltozáskor azonnali hatállyal felmondhat (15.4 pont).',
        quote: 'ha a Szállító feletti irányítás megváltozik, vagy a Szállító tulajdonosi körébe a Megrendelő versenytársa lép be',
        pageIndex: null,
      },
      {
        pillar: 'OPERATIONS',
        statement: 'Az SLA 99,9%-os havi rendelkezésre állást ír elő, óránként a havi díj 5%-ának megfelelő kötbérrel.',
        quote: 'Minden megkezdett óra kiesés után a Szállító a havi szolgáltatási díj 5%-ának megfelelő kötbért fizet',
        pageIndex: null,
      },
    ],
    missingProvisions: ['Felelősségkorlátozás', 'Kötbérplafon az SLA-ban'],
  },
};

export const SAMPLE_DOCUMENTS: Record<string, SampleDocument[]> = {
  gyarto: [GYARTO_KERET, GYARTO_MEGBIZASI, ...financialSampleDocuments('gyarto')],
  epitoipar: [EPITO_VALLALKOZASI, ...financialSampleDocuments('epitoipar')],
  konyvelo: [KONYVELO_KERET, ...financialSampleDocuments('konyvelo')],
  'it-fejleszto': [IT_KERET, ...financialSampleDocuments('it-fejleszto')],
};

/** Mintadokumentum → rekord, ugyanazzal a maszkolással és ellenőrzéssel, mint élesben. */
export function sampleDocumentRecord(doc: SampleDocument, id: string): DocumentRecord {
  const { pages, counts } = redactPages(doc.pages);
  return {
    id,
    fileName: doc.fileName,
    format: doc.format,
    pageLabels: pages.map((p) => p.label),
    redactions: counts,
    analyzedAt: new Date().toISOString(),
    analysis: verifyDocumentAnalysis(doc.analysis, pages),
    isSample: true,
  };
}

/** A minta szövege a felületen (maszkolva), hogy látszódjon, mit kapott az AI. */
export function samplePagesRedacted(doc: SampleDocument): DocumentPage[] {
  return redactPages(doc.pages).pages;
}
