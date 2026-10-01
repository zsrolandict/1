import type { FactKey, FinField } from '../financials/model';

/**
 * Irattípusok. Feltöltéskor a tanácsadó kiválasztja (vagy „Felismerés”), és
 * ettől függ, mit keres az AI (célzott ellenőrzőlista), milyen számokat és
 * tényeket olvas ki (pénzügyi iratoknál), és melyik bekérési tétel lesz
 * „Beérkezett”.
 */

export type DocType =
  | 'AUTO'
  | 'FIN_STATEMENT'
  | 'NOTES'
  | 'AUDIT_REPORT'
  | 'MGMT_LETTER'
  | 'BUSINESS_REPORT'
  | 'RESOLUTION'
  | 'INTERIM'
  | 'TAX_ACCOUNT'
  | 'TAX_AUDIT'
  | 'TAX_RETURN'
  | 'LOAN'
  | 'GRANT'
  | 'ARTICLES'
  | 'SHAREHOLDER_AGREEMENT'
  | 'CUSTOMER_CONTRACT'
  | 'SUPPLIER_CONTRACT'
  | 'EMPLOYMENT'
  | 'LEASE'
  | 'INSURANCE'
  | 'DATA_PROTECTION'
  | 'LITIGATION'
  | 'OTHER';

export type DocGroup = 'Pénzügyi beszámoló' | 'Adó és hatóság' | 'Finanszírozás és támogatás' | 'Társasági és szerződések' | 'HR és egyéb';

export interface DocTypeSpec {
  label: string;
  group: DocGroup | null;
  /** Mit keressen az AI ebben az iratban (célzott ellenőrzőlista). */
  lookFor: string[];
  /** Bekérési tételek, amelyeket ez az irat teljesít (iratbekérési lista azonosítói). */
  requests: string[];
  /** Kiolvasandó beszámolósorok (pénzügyi iratoknál). */
  fields?: FinField[];
  /** Kiolvasandó tények. */
  facts?: FactKey[];
}

const ALL_FIELDS: FinField[] = [
  'revenue',
  'materialCosts',
  'personnelCosts',
  'depreciation',
  'operatingProfit',
  'netProfit',
  'equity',
  'shareCapital',
  'provisions',
  'longTermLiabilities',
  'shortTermLiabilities',
  'currentAssets',
  'cash',
  'receivables',
  'payables',
  'inventory',
];

export const DOC_TYPES: Record<DocType, DocTypeSpec> = {
  AUTO: { label: 'Felismerés (az AI dönti el)', group: null, lookFor: [], requests: [] },
  FIN_STATEMENT: {
    label: 'Éves beszámoló (mérleg, eredménykimutatás)',
    group: 'Pénzügyi beszámoló',
    lookFor: ['a tárgyév és az előző év oszlopa', 'a számok egysége (Ft vagy ezer Ft)', 'negatív saját tőke, eredménytartalék', 'jelentős céltartalék'],
    requests: ['B03'],
    fields: ALL_FIELDS,
  },
  NOTES: {
    label: 'Kiegészítő melléklet',
    group: 'Pénzügyi beszámoló',
    lookFor: [
      'függő és jövőbeni kötelezettségek, kezesség, garancia, zálogjog',
      'kapcsolt felekkel kötött ügyletek',
      'peres ügyek, céltartalék oka',
      'mérlegfordulónap utáni események',
      'számviteli politika változása, korábbi évek jelentős hibái, önellenőrzés',
      'vezetőknek adott előleg, kölcsön; tagi kölcsönök',
      'átlagos statisztikai létszám',
      'lízing, támogatások',
    ],
    requests: ['B03'],
    fields: ['provisions'],
    facts: [
      'contingentHuf',
      'litigationCount',
      'litigationHuf',
      'relatedPartyInNotes',
      'pledges',
      'ownerLoansHuf',
      'avgHeadcount',
      'grantHuf',
      'grantSustainUntil',
      'grantOwnerChangeConsent',
      'loanHuf',
      'loanMaturity',
      'loanChangeOfControl',
    ],
  },
  AUDIT_REPORT: {
    label: 'Független könyvvizsgálói jelentés',
    group: 'Pénzügyi beszámoló',
    lookFor: [
      'a vélemény típusa: minősítés nélküli, minősített, ellenvélemény, véleménynyilvánítás visszautasítása',
      'lényeges bizonytalanság a vállalkozás folytatására',
      'figyelemfelhívás',
      'kulcsfontosságú könyvvizsgálati kérdések',
    ],
    requests: ['B03'],
    facts: ['auditOpinion', 'goingConcern', 'emphasisOfMatter'],
  },
  MGMT_LETTER: {
    label: 'Könyvvizsgálói vezetői levél (management letter)',
    group: 'Pénzügyi beszámoló',
    lookFor: ['belső kontroll hiányosságai', 'javasolt intézkedések és a vezetés válasza', 'ismétlődő megállapítások'],
    requests: [],
    facts: ['managementLetterIssues'],
  },
  BUSINESS_REPORT: {
    label: 'Üzleti jelentés',
    group: 'Pénzügyi beszámoló',
    lookFor: ['a vezetés által megnevezett kockázatok', 'tervek, beruházások', 'piaci helyzet'],
    requests: [],
  },
  RESOLUTION: {
    label: 'Beszámolót elfogadó / osztalékról szóló határozat',
    group: 'Pénzügyi beszámoló',
    lookFor: ['a beszámoló elfogadása', 'osztalék összege', 'eredménytartalék felhasználása'],
    requests: [],
    facts: ['dividendHuf'],
  },
  INTERIM: {
    label: 'Időközi mérleg és eredménykimutatás',
    group: 'Pénzügyi beszámoló',
    lookFor: ['a tárgyévi időszak és a hónap', 'eltérés az előző év azonos időszakától'],
    requests: ['K10'],
  },
  TAX_ACCOUNT: {
    label: 'NAV-folyószámla / adóigazolás',
    group: 'Adó és hatóság',
    lookFor: ['tartozás adónemenként', 'késedelmi pótlék', 'fizetési könnyítés, részletfizetés', 'köztartozásmentesség'],
    requests: ['B10'],
    facts: ['taxDebtHuf', 'taxClean'],
  },
  TAX_AUDIT: {
    label: 'NAV- / hatósági ellenőrzés jegyzőkönyve, határozata',
    group: 'Adó és hatóság',
    lookFor: ['ellenőrzött időszak és adónem', 'megállapítás, adókülönbözet, bírság', 'ismétlődő hibák'],
    requests: ['K18'],
    facts: ['lastTaxAuditYear', 'lastTaxAuditFinding'],
  },
  TAX_RETURN: {
    label: 'Adóbevallás (társasági adó, iparűzési adó, ÁFA)',
    group: 'Adó és hatóság',
    lookFor: ['adóalap és a beszámoló egyezése', 'önellenőrzés', 'ÁFA-bevallás és az Online Számla eltérése'],
    requests: ['B10'],
    facts: ['selfRevisions'],
  },
  LOAN: {
    label: 'Hitel-, lízing- vagy garanciaszerződés',
    group: 'Finanszírozás és támogatás',
    lookFor: [
      'összeg, lejárat, törlesztés',
      'kovenánsok és teljesülésük',
      'tulajdonosváltási (change of control) záradék',
      'biztosítékok, zálogjog',
      'felmondási okok',
    ],
    requests: ['B09'],
    facts: ['loanHuf', 'loanMaturity', 'covenantsOk', 'loanChangeOfControl', 'pledges'],
  },
  GRANT: {
    label: 'Támogatási szerződés',
    group: 'Finanszírozás és támogatás',
    lookFor: [
      'támogatás összege',
      'fenntartási időszak vége',
      'vállalt mutatók (létszám, árbevétel)',
      'tulajdonosváltáshoz szükséges hozzájárulás',
      'visszafizetési feltételek',
    ],
    requests: [],
    facts: ['grantHuf', 'grantSustainUntil', 'grantOwnerChangeConsent'],
  },
  ARTICLES: {
    label: 'Létesítő okirat',
    group: 'Társasági és szerződések',
    lookFor: ['elővásárlási jog', 'üzletrész-átruházás feltételei', 'képviselet', 'taggyűlési hatáskörök, minősített többség'],
    requests: ['B02'],
  },
  SHAREHOLDER_AGREEMENT: {
    label: 'Tulajdonosi (szindikátusi) megállapodás',
    group: 'Társasági és szerződések',
    lookFor: ['vétójogok', 'drag-along, tag-along', 'kilépés, kizárás', 'versenytilalom'],
    requests: ['K11'],
  },
  CUSTOMER_CONTRACT: {
    label: 'Vevői szerződés / ÁSZF',
    group: 'Társasági és szerződések',
    lookFor: ['felelősségkorlátozás', 'kötbér és felső korlátja', 'tulajdonosváltási felmondás', 'kizárólagosság', 'felmondási idő', 'fizetési határidő'],
    requests: ['B08', 'S01'],
  },
  SUPPLIER_CONTRACT: {
    label: 'Szállítói / beszállítói szerződés',
    group: 'Társasági és szerződések',
    lookFor: ['kizárólagosság', 'minimális lehívás', 'árindexálás', 'tulajdonosváltási felmondás', 'felmondási idő'],
    requests: ['B08', 'S15'],
  },
  EMPLOYMENT: {
    label: 'Munka-, megbízási vagy vállalkozói szerződés',
    group: 'HR és egyéb',
    lookFor: [
      'jogviszony jellege, munkarend, eszközök (színlelés)',
      'versenytilalom és ellenértéke',
      'szellemi alkotások vagyoni jogainak átruházása',
      'felmondás, végkielégítés',
    ],
    requests: ['B12', 'K13'],
  },
  LEASE: {
    label: 'Bérleti szerződés / tulajdoni lap',
    group: 'HR és egyéb',
    lookFor: ['lejárat, meghosszabbítás', 'terhek a tulajdoni lapon', 'tulajdonosváltás hatása', 'bérleti díj indexálása'],
    requests: ['F05'],
  },
  INSURANCE: {
    label: 'Biztosítási kötvény',
    group: 'HR és egyéb',
    lookFor: ['limit, önrész', 'kizárások', 'lejárat', 'biztosított tevékenységek'],
    requests: ['B14', 'S02'],
    facts: ['liabilityInsurance', 'insuranceLimitHuf'],
  },
  DATA_PROTECTION: {
    label: 'Adatkezelési nyilvántartás / adatfeldolgozói szerződés',
    group: 'HR és egyéb',
    lookFor: ['hiányzó adatfeldolgozói szerződés', 'külföldre továbbítás', 'adatmegőrzési idő', 'adatvédelmi incidensek'],
    requests: ['F08'],
  },
  LITIGATION: {
    label: 'Peres irat / ügyvédi levél',
    group: 'HR és egyéb',
    lookFor: ['perérték', 'a per tárgya és állása', 'várható kimenetel', 'céltartalék'],
    requests: ['B13', 'F09'],
    facts: ['litigationCount', 'litigationHuf'],
  },
  OTHER: { label: 'Egyéb irat', group: 'HR és egyéb', lookFor: [], requests: [] },
};

export const DOC_TYPE_GROUPS: DocGroup[] = ['Pénzügyi beszámoló', 'Adó és hatóság', 'Finanszírozás és támogatás', 'Társasági és szerződések', 'HR és egyéb'];

export const isDocType = (s: unknown): s is DocType => typeof s === 'string' && s in DOC_TYPES;

/** Kiolvas-e számot / tényt ez a típus. */
export const extractsFinancials = (t: DocType | undefined) => Boolean(t && (DOC_TYPES[t].fields?.length || DOC_TYPES[t].facts?.length));
