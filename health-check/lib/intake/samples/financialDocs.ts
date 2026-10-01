import type { DocumentPage, ExtractedFact, ExtractedValue, RawDocumentAnalysis } from '../documents/types';
import { FIN_FIELD_LABEL, type FactKey, type FinField } from '../financials/model';
import { factValue } from '../financials/extract';
import type { SampleDocument } from './documents';

/**
 * KITALÁLT beszámoló-csomag a bemutató cégekhez: éves beszámoló (kivonat),
 * kiegészítő melléklet (kivonat) és könyvvizsgálói jelentés. Valós céget,
 * személyt nem ábrázolnak. A szöveg és a „kiolvasás” ugyanabból a számsorból
 * készül, és ugyanazon az idézet-ellenőrzésen megy át, mint egy élő elemzés.
 */

type Row = Partial<Record<FinField, [number, number]>>; // ezer Ft: [tárgyév, előző év]

interface Spec {
  company: string;
  slug: string;
  year: number;
  rows: Row;
  /** A melléklet bekezdései: szöveg + a belőle kiolvasott tény (ha van). */
  notes: { text: string; fact?: { key: FactKey; value: string } }[];
  audit: { opinionText: string; opinion: string; extra?: { text: string; key: FactKey; value: string }[] };
  findings?: RawDocumentAnalysis['findings'];
}

/** Ezres tagolás sima szóközzel (a PDF-ből kinyert szövegben is így áll). */
const fmt = (n: number) => {
  const s = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return n < 0 ? `(${s})` : s;
};

const ORDER: FinField[] = [
  'revenue',
  'materialCosts',
  'personnelCosts',
  'depreciation',
  'operatingProfit',
  'netProfit',
  'currentAssets',
  'inventory',
  'receivables',
  'cash',
  'equity',
  'shareCapital',
  'provisions',
  'longTermLiabilities',
  'shortTermLiabilities',
  'payables',
];

function statement(s: Spec): SampleDocument {
  const lines = ORDER.filter((f) => s.rows[f]).map((f) => {
    const [cur, prev] = s.rows[f]!;
    return { f, line: `${FIN_FIELD_LABEL[f]} ${fmt(prev)} ${fmt(cur)}` };
  });
  const head = `${s.company}\n${s.year}. ÉVI EGYSZERŰSÍTETT ÉVES BESZÁMOLÓ (kivonat)\nAdatok ezer forintban. Oszlopok: előző év (${s.year - 1}), tárgyév (${s.year}).`;
  const pages: DocumentPage[] = [
    {
      label: '1. oldal',
      text: `${head}\nEREDMÉNYKIMUTATÁS\n${lines
        .slice(0, 6)
        .map((l) => l.line)
        .join('\n')}`,
    },
    {
      label: '2. oldal',
      text: `MÉRLEG\n${lines
        .slice(6)
        .map((l) => l.line)
        .join('\n')}`,
    },
  ];
  const values: ExtractedValue[] = lines.flatMap(({ f, line }) => {
    const [cur, prev] = s.rows[f]!;
    return [
      { field: f, year: s.year, valueHuf: cur * 1000, stated: fmt(cur), quote: line, pageIndex: null },
      { field: f, year: s.year - 1, valueHuf: prev * 1000, stated: fmt(prev), quote: line, pageIndex: null },
    ];
  });
  return {
    fileName: `Beszamolo_${s.year}_${s.slug}.pdf`,
    format: 'PDF',
    pages,
    analysis: {
      documentType: 'Egyszerűsített éves beszámoló (mérleg, eredménykimutatás)',
      docType: 'FIN_STATEMENT',
      summary: `${s.company} ${s.year}. évi beszámolójának kivonata ezer forintban, az előző évvel összehasonlítva.`,
      findings: [],
      facts: [],
      missingProvisions: [],
      financials: { unit: 'THOUSAND_HUF', values, facts: [] },
    },
  };
}

function notes(s: Spec): SampleDocument {
  const text = s.notes.map((n, i) => `${i + 1}. ${n.text}`).join('\n');
  const facts: ExtractedFact[] = s.notes.flatMap((n) => {
    if (!n.fact) return [];
    const value = factValue(n.fact.key, n.fact.value, 'THOUSAND_HUF');
    return value == null ? [] : [{ key: n.fact.key, value: value as string | number | boolean, quote: n.text, pageIndex: null }];
  });
  return {
    fileName: `Kiegeszito_melleklet_${s.year}_${s.slug}.pdf`,
    format: 'PDF',
    pages: [{ label: '1. oldal', text: `${s.company}\nKIEGÉSZÍTŐ MELLÉKLET a ${s.year}. évi beszámolóhoz (kivonat)\n${text}` }],
    analysis: {
      documentType: 'Kiegészítő melléklet',
      docType: 'NOTES',
      summary: `A ${s.year}. évi beszámoló kiegészítő mellékletének kivonata: kötelezettségvállalások, kapcsolt ügyletek, perek, létszám.`,
      findings: s.findings ?? [],
      facts: [],
      missingProvisions: [],
      financials: { unit: 'THOUSAND_HUF', values: [], facts },
    },
  };
}

function audit(s: Spec): SampleDocument {
  const parts = [s.audit.opinionText, ...(s.audit.extra ?? []).map((e) => e.text)];
  const facts: ExtractedFact[] = [
    { key: 'auditOpinion' as FactKey, value: s.audit.opinion, quote: s.audit.opinionText },
    ...(s.audit.extra ?? []).map((e) => ({ key: e.key, value: e.value, quote: e.text })),
  ].flatMap((f) => {
    const value = factValue(f.key, f.value);
    return value == null ? [] : [{ key: f.key, value: value as string | number | boolean, quote: f.quote, pageIndex: null }];
  });
  return {
    fileName: `Konyvvizsgaloi_jelentes_${s.year}_${s.slug}.pdf`,
    format: 'PDF',
    pages: [{ label: '1. oldal', text: `FÜGGETLEN KÖNYVVIZSGÁLÓI JELENTÉS\n${s.company} tulajdonosai részére\n${parts.join('\n')}` }],
    analysis: {
      documentType: 'Független könyvvizsgálói jelentés',
      docType: 'AUDIT_REPORT',
      summary: `A ${s.year}. évi beszámolóról szóló könyvvizsgálói jelentés.`,
      findings: [],
      facts: [],
      missingProvisions: [],
      financials: { unit: 'HUF', values: [], facts },
    },
  };
}

const SPECS: Record<string, Spec> = {
  'it-fejleszto': {
    company: 'Példa Szoftverház Kft.',
    slug: 'Pelda_Szoftverhaz',
    year: 2025,
    rows: {
      revenue: [2_104_350, 1_954_220],
      materialCosts: [960_400, 905_300],
      personnelCosts: [520_600, 468_000],
      depreciation: [48_500, 44_100],
      operatingProfit: [142_300, 128_900],
      netProfit: [118_400, 104_700],
      currentAssets: [980_500, 910_200],
      inventory: [12_400, 11_800],
      receivables: [432_100, 365_800],
      cash: [162_300, 141_900],
      equity: [612_800, 546_900],
      shareCapital: [3_000, 3_000],
      provisions: [25_000, 0],
      longTermLiabilities: [140_000, 180_000],
      shortTermLiabilities: [520_400, 488_700],
      payables: [210_300, 198_500],
    },
    notes: [
      {
        text: 'A társaság a Példa Holding Zrt. kapcsolt vállalkozástól szoftverlicencet vesz igénybe, a tárgyévi licencdíj 96 000 ezer forint.',
        fact: { key: 'relatedPartyInNotes', value: 'igen' },
      },
      { text: 'A tagi kölcsön egyenlege a mérleg fordulónapján 85 000 ezer forint, kamata évi 2 százalék.', fact: { key: 'ownerLoansHuf', value: '85 000' } },
      { text: 'A tárgyévi átlagos statisztikai létszám 38 fő.', fact: { key: 'avgHeadcount', value: '38' } },
      { text: 'A GINOP program keretében elnyert vissza nem térítendő támogatás összege 180 000 ezer forint.', fact: { key: 'grantHuf', value: '180 000' } },
      { text: 'A támogatás fenntartási időszaka 2027.12.31-ig tart.', fact: { key: 'grantSustainUntil', value: '2027.12.31' } },
      {
        text: 'A támogatási szerződés szerint a tulajdonosi kör változásához a Támogató előzetes írásbeli hozzájárulása szükséges.',
        fact: { key: 'grantOwnerChangeConsent', value: 'igen' },
      },
    ],
    audit: {
      opinionText:
        'Véleményünk szerint a mellékelt éves beszámoló megbízható és valós képet ad a társaság vagyoni és pénzügyi helyzetéről; minősítés nélküli véleményt bocsátunk ki.',
      opinion: 'minősítés nélküli',
      extra: [{ text: 'Nem azonosítottunk a vállalkozás folytatására vonatkozó lényeges bizonytalanságot.', key: 'goingConcern', value: 'nem' }],
    },
  },
  epitoipar: {
    company: 'Példa Építőipari Kft.',
    slug: 'Pelda_Epitoipari',
    year: 2025,
    rows: {
      revenue: [3_812_600, 5_020_400],
      materialCosts: [2_876_700, 3_912_000],
      personnelCosts: [402_100, 398_700],
      depreciation: [61_200, 58_300],
      operatingProfit: [-30_900, 253_400],
      netProfit: [-58_200, 188_100],
      currentAssets: [1_402_800, 1_510_900],
      inventory: [214_500, 198_300],
      receivables: [981_400, 1_052_700],
      cash: [48_200, 120_400],
      equity: [248_600, 306_800],
      shareCapital: [50_000, 50_000],
      provisions: [35_000, 12_000],
      longTermLiabilities: [420_000, 380_000],
      shortTermLiabilities: [1_486_300, 1_102_400],
      payables: [702_300, 655_100],
    },
    notes: [
      {
        text: 'A társaság által nyújtott jóteljesítési és előleg-visszafizetési bankgaranciák állománya a fordulónapon 650 000 ezer forint.',
        fact: { key: 'contingentHuf', value: '650 000' },
      },
      { text: 'A társaság ellen 2 per van folyamatban, összesen 142 000 ezer forint perértékkel.', fact: { key: 'litigationCount', value: '2' } },
      {
        text: 'A folyamatban lévő perek perértéke összesen 142 000 ezer forint, amelyre 35 000 ezer forint céltartalékot képeztünk.',
        fact: { key: 'litigationHuf', value: '142 000' },
      },
      { text: 'A beruházási hitel biztosítékául jelzálogjog terheli a telephely ingatlant.', fact: { key: 'pledges', value: 'igen' } },
      { text: 'A tárgyévi átlagos statisztikai létszám 62 fő.', fact: { key: 'avgHeadcount', value: '62' } },
    ],
    findings: [
      {
        templateCode: 'PA-10',
        pillar: 'LEGAL',
        title: 'Jelentős függő kötelezettség (kezesség, garancia)',
        rationale: 'A bankgaranciák állománya a saját tőke két és félszerese; egy lehívás a likviditást közvetlenül terhelné.',
        quote: 'jóteljesítési és előleg-visszafizetési bankgaranciák állománya a fordulónapon 650 000 ezer forint',
        likelihood: 3,
        impact: 4,
        exposureHufEstimate: 650_000_000,
        confidence: 0.85,
        pageIndex: null,
      },
    ],
    audit: {
      opinionText:
        'Minősített véleményünk szerint – a befejezetlen termelés értékelésével kapcsolatos korlátozás hatásától eltekintve – a beszámoló megbízható és valós képet ad.',
      opinion: 'minősített',
      extra: [
        {
          text: 'Figyelemfelhívás: felhívjuk a figyelmet a kiegészítő melléklet 2. pontjára, amely a folyamatban lévő peres eljárásokat mutatja be.',
          key: 'emphasisOfMatter',
          value: 'igen',
        },
      ],
    },
  },
  konyvelo: {
    company: 'Példa Könyvelő Iroda Kft.',
    slug: 'Pelda_Konyvelo',
    year: 2025,
    rows: {
      revenue: [1_214_800, 1_168_300],
      materialCosts: [250_400, 242_100],
      personnelCosts: [575_700, 552_800],
      depreciation: [22_100, 20_900],
      operatingProfit: [168_400, 159_200],
      netProfit: [141_200, 133_800],
      currentAssets: [512_800, 468_300],
      receivables: [159_700, 150_900],
      cash: [288_400, 251_200],
      equity: [486_300, 418_100],
      shareCapital: [3_000, 3_000],
      shortTermLiabilities: [132_600, 121_400],
      payables: [41_200, 39_800],
    },
    notes: [
      { text: 'A tárgyévi átlagos statisztikai létszám 31 fő.', fact: { key: 'avgHeadcount', value: '31' } },
      { text: 'A társaság kezességet, garanciát nem vállalt, mérlegen kívüli kötelezettsége nincs.', fact: { key: 'contingentHuf', value: '0' } },
    ],
    audit: {
      opinionText:
        'Véleményünk szerint a mellékelt éves beszámoló megbízható és valós képet ad a társaság vagyoni és pénzügyi helyzetéről; minősítés nélküli véleményt bocsátunk ki.',
      opinion: 'minősítés nélküli',
    },
  },
  gyarto: {
    company: 'Minta Gyártó Kft.',
    slug: 'Minta_Gyarto',
    year: 2025,
    rows: {
      revenue: [2_412_600, 2_288_900],
      materialCosts: [1_386_200, 1_318_700],
      personnelCosts: [423_300, 398_200],
      depreciation: [96_300, 91_800],
      operatingProfit: [158_700, 149_300],
      netProfit: [121_900, 115_400],
      currentAssets: [1_088_600, 1_012_400],
      inventory: [312_400, 298_100],
      receivables: [475_900, 451_300],
      cash: [118_900, 97_500],
      equity: [884_200, 812_300],
      shareCapital: [20_000, 20_000],
      longTermLiabilities: [420_000, 510_000],
      shortTermLiabilities: [498_300, 472_100],
      payables: [236_800, 224_500],
    },
    notes: [
      { text: 'A beruházási hitel állománya 420 000 ezer forint, végső lejárata 2027.03.31.', fact: { key: 'loanHuf', value: '420 000' } },
      { text: 'A beruházási hitel végső lejárata 2027.03.31, a törlesztés negyedéves.', fact: { key: 'loanMaturity', value: '2027.03.31' } },
      {
        text: 'A hitelszerződés szerint a társaság tulajdonosi szerkezetének változása esetén a bank a szerződést felmondhatja.',
        fact: { key: 'loanChangeOfControl', value: 'igen' },
      },
      { text: 'A tárgyévi átlagos statisztikai létszám 136 fő.', fact: { key: 'avgHeadcount', value: '136' } },
    ],
    audit: {
      opinionText:
        'Véleményünk szerint a mellékelt éves beszámoló megbízható és valós képet ad a társaság vagyoni és pénzügyi helyzetéről; minősítés nélküli véleményt bocsátunk ki.',
      opinion: 'minősítés nélküli',
    },
  },
};

/** A bemutató cég beszámoló-csomagja (üres, ha nincs). */
export function financialSampleDocuments(scenarioId: string): SampleDocument[] {
  const s = SPECS[scenarioId];
  return s ? [statement(s), notes(s), audit(s)] : [];
}
