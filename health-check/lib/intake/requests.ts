import { ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import type { Pillar } from '@/lib/risk/types';
import type { TableKind } from './tables/spec';

/**
 * Előzetes tényállás → iratbekérési lista.
 *
 * Az alap iratkört minden átvilágításnál bekérjük; erre épülnek a
 * kiegészítések a cél (átvilágítás-típus), az ágazat, a létszám és a
 * tényállás jellemzői alapján. Minden tétel mellett ott az indok, hogy a
 * tanácsadó és az ügyfél is értse, miért kérjük. Szabály alapú: ugyanarra
 * a tényállásra mindig ugyanaz a lista. Az AI (casePrompts.ts) legfeljebb
 * extra iratot és jellemzőt JAVASOL, amit a tanácsadó vesz fel.
 */

export type Sector = 'MANUFACTURING' | 'CONSTRUCTION' | 'TRADE' | 'CONSULTING' | 'IT' | 'ACCOUNTING' | 'OTHER';

export const SECTOR_LABEL: Record<Sector, string> = {
  MANUFACTURING: 'Gyártás, ipar',
  CONSTRUCTION: 'Építőipar',
  TRADE: 'Kereskedelem, nagykereskedelem',
  CONSULTING: 'Tanácsadás, szakmai szolgáltatás',
  IT: 'Informatika, szoftverfejlesztés',
  ACCOUNTING: 'Könyvelés, pénzügyi szolgáltatás',
  OTHER: 'Egyéb',
};

export type CaseFlag =
  | 'MULTIPLE_OWNERS'
  | 'FAMILY'
  | 'RELATED_PARTIES'
  | 'OWN_IP'
  | 'CONTRACTORS'
  | 'REAL_ESTATE'
  | 'PERMITS'
  | 'PUBLIC_PROCUREMENT'
  | 'BANK_FINANCING'
  | 'FOREIGN'
  | 'PERSONAL_DATA'
  | 'KEY_CLIENTS'
  | 'LITIGATION';

export const FLAG_LABEL: Record<CaseFlag, string> = {
  MULTIPLE_OWNERS: 'Több tulajdonos',
  FAMILY: 'Családi cég',
  RELATED_PARTIES: 'Kapcsolt vállalkozások / tulajdonosi ügyletek',
  OWN_IP: 'Saját szoftver, szellemi tulajdon',
  CONTRACTORS: 'Megbízottak, alvállalkozók, számlás munkatársak',
  REAL_ESTATE: 'Saját vagy bérelt ingatlan jelentős súllyal',
  PERMITS: 'Engedélyköteles tevékenység',
  PUBLIC_PROCUREMENT: 'Közbeszerzés, állami megrendelő',
  BANK_FINANCING: 'Banki hitel, lízing, garancia',
  FOREIGN: 'Külföldi ügyletek, deviza',
  PERSONAL_DATA: 'Sok személyes adat kezelése (ügyfél, bér)',
  KEY_CLIENTS: 'Néhány kulcsügyféltől való függés',
  LITIGATION: 'Folyamatban lévő vagy várható jogvita',
};

export interface CaseProfile {
  /** Egy cégnek több ágazata is lehet (pl. gyártás és kereskedelem). */
  sectors: Sector[];
  headcount: number | null;
  flags: CaseFlag[];
  /** Szabad szöveges tényállás: mi a helyzet, miért kérték az átvilágítást. */
  narrative: string;
}

export const EMPTY_PROFILE: CaseProfile = { sectors: [], headcount: null, flags: [], narrative: '' };

/** Régi mentés (egyetlen `sector` mező) átalakítása. */
export function normalizeProfile(p: Partial<CaseProfile> & { sector?: Sector | null }): CaseProfile {
  const sectors = Array.isArray(p.sectors) ? p.sectors : p.sector ? [p.sector] : [];
  return { sectors, headcount: p.headcount ?? null, flags: Array.isArray(p.flags) ? p.flags : [], narrative: p.narrative ?? '' };
}

export type RequestSource = 'BASE' | 'KIND' | 'SECTOR' | 'SIZE' | 'FLAG' | 'AI' | 'MANUAL';

export const SOURCE_LABEL: Record<RequestSource, string> = {
  BASE: 'Alap iratkör',
  KIND: 'A cél miatt',
  SECTOR: 'Ágazat miatt',
  SIZE: 'Létszám miatt',
  FLAG: 'Tényállás miatt',
  AI: 'AI-javaslat',
  MANUAL: 'Kézi',
};

export interface DocRequest {
  id: string;
  title: string;
  pillar: Pillar;
  /** Miért kérjük – egy vagy több indok. */
  why: string[];
  source: RequestSource;
  priority: 'REQUIRED' | 'RECOMMENDED';
  /** Ha a tábla az Adattáblák fülön feldolgozható. */
  table?: TableKind;
}

interface Template {
  id: string;
  title: string;
  pillar: Pillar;
  table?: TableKind;
}

const T = (id: string, title: string, pillar: Pillar, table?: TableKind): Template => ({ id, title, pillar, table });

// ── Iratkatalógus ───────────────────────────────────────────────────
const DOCS = {
  companyExtract: T('B01', 'Hatályos cégkivonat', 'LEGAL'),
  articles: T('B02', 'Létesítő okirat egységes szerkezetben (tulajdonosi jogok, átruházás, elővásárlás)', 'LEGAL'),
  statements: T('B03', 'Beszámolók az utolsó 3 évre (könyvvizsgálói jelentéssel, ha van)', 'FINANCE'),
  trialBalance: T('B04', 'Főkönyvi kivonat (utolsó lezárt év és tárgyév)', 'FINANCE'),
  arAging: T('B05', 'Vevői korosítás a fordulónapra (nyitott tételek)', 'FINANCE', 'AR_AGING'),
  salesByCustomer: T('B06', 'Vevőnkénti árbevétel (utolsó 12 hónap)', 'OPERATIONS', 'SALES_BY_CUSTOMER'),
  purchases: T('B07', 'Szállítónkénti beszerzés (utolsó 12 hónap)', 'OPERATIONS', 'PURCHASES_BY_SUPPLIER'),
  topContracts: T('B08', 'Top 10 vevői és szállítói szerződés', 'LEGAL'),
  loans: T('B09', 'Hitel-, lízing- és garanciaszerződések', 'FINANCE'),
  taxReturns: T('B10', 'Adóbevallások és NAV-folyószámla-kivonat (2 év)', 'FINANCE'),
  headcount: T('B11', 'Létszám- és bérkimutatás munkakörönként, jogviszony szerint (álnevesítve)', 'HR'),
  employmentForms: T('B12', 'Munkaszerződés-minta; megbízási és vállalkozói szerződések listája', 'HR'),
  litigationList: T('B13', 'Folyamatban lévő perek és hatósági eljárások listája', 'LEGAL'),
  insurance: T('B14', 'Biztosítási kötvények (vagyon, felelősség)', 'OPERATIONS'),
  relatedParty: T('B15', 'Kapcsolt ügyletek listája és transzferár-nyilvántartás', 'FINANCE', 'RELATED_PARTY'),

  businessPlan: T('K01', 'Éves üzleti terv / költségvetés', 'OPERATIONS'),
  mgmtReport: T('K02', 'Havi vezetői riport (minta hónap)', 'OPERATIONS'),
  dataRoomIndex: T('K03', 'Adatszoba tartalomjegyzéke / meglévő dokumentumlista', 'LEGAL'),
  ipRegister: T('K04', 'Szellemi tulajdon nyilvántartás (védjegy, szoftver, domain)', 'LEGAL'),
  permitList: T('K05', 'Engedélyek listája lejárattal', 'OPERATIONS'),
  termSheet: T('K06', 'Ajánlat / term sheet, vételár-mechanizmus', 'FINANCE'),
  contingent: T('K07', 'Függő kötelezettségek: kezességek, garanciák, kötelezettségvállalások', 'FINANCE'),
  cashflowPlan: T('K08', '12 hónapos cash-flow terv', 'FINANCE'),
  covenants: T('K09', 'Hitelkovenánsok és teljesítésük kimutatása', 'FINANCE'),
  interim: T('K10', 'Tárgyévi időközi mérleg és eredménykimutatás', 'FINANCE'),
  ownersAgreement: T('K11', 'Tulajdonosi (szindikátusi) megállapodás', 'LEGAL'),
  ownerLoans: T('K12', 'Tagi és tulajdonosi kölcsönök kimutatása', 'FINANCE'),
  keyPeopleContracts: T('K13', 'Vezetők és kulcsemberek szerződései (versenytilalom, megtartás, felmondás)', 'HR'),
  successionPlan: T('K14', 'Utódlási / átadási elképzelés (ha van írásban)', 'HR'),
  clientOwnership: T('K15', 'Top 20 ügyfél és a kapcsolattartó munkatárs', 'OPERATIONS'),
  privateAssets: T('K16', 'Tulajdonosi használatú céges eszközök, ingatlanok, juttatások', 'FINANCE'),
  policies: T('K17', 'Belső szabályzatok (adatvédelem, pénzmosás, munkavédelem, informatika)', 'LEGAL'),
  inspections: T('K18', 'Hatósági ellenőrzések jegyzőkönyvei (5 év)', 'LEGAL'),
  orgChart: T('K19', 'Szervezeti ábra és kulcspozíciók', 'HR'),
  itSystems: T('K20', 'Informatikai rendszerek és licencek listája', 'OPERATIONS'),
  retention: T('K21', 'Megtartási és versenytilalmi megállapodások', 'HR'),

  clientTemplates: T('S01', 'Ügyfélszerződés-minták, ÁSZF (díjazás, felelősség, felmondás)', 'LEGAL'),
  pi: T('S02', 'Szakmai felelősségbiztosítás kötvénye (limit, kizárások)', 'LEGAL'),
  projectRevenue: T('S03', 'Projekt- és óradíj-kimutatás ügyfelenként (kihasználtság)', 'OPERATIONS'),
  subcontracts: T('S04', 'Alvállalkozói és szakértői megbízási szerződések', 'HR'),
  qualifications: T('S05', 'Jogszabály által előírt szakmai képesítések, nyilvántartásba vételek', 'HR'),
  sourceCode: T('S06', 'Forráskód-tulajdon és licencek; nyílt forráskódú komponensek jegyzéke', 'LEGAL'),
  sla: T('S07', 'SLA-k és támogatási szerződések', 'LEGAL'),
  infosec: T('S08', 'Információbiztonsági szabályzat, mentési és visszaállítási teszt', 'OPERATIONS'),
  projects: T('S09', 'Futó projektek listája (készültség, kötbér, garancia)', 'OPERATIONS'),
  guarantees: T('S10', 'Jóteljesítési és bankgaranciák állománya', 'FINANCE'),
  hse: T('S11', 'Munkavédelmi dokumentáció', 'HR'),
  envPermits: T('S12', 'Telephelyi és környezetvédelmi engedélyek', 'OPERATIONS'),
  assets: T('S13', 'Gép- és eszközlista (kor, állapot, tulajdon)', 'OPERATIONS'),
  certificates: T('S14', 'Minőségügyi tanúsítványok', 'OPERATIONS'),
  supplyContracts: T('S15', 'Beszállítói és forgalmazói keretszerződések', 'LEGAL'),
  inventory: T('S16', 'Készletkimutatás és készletkorosítás', 'FINANCE'),
  aml: T('S17', 'Pénzmosás elleni szabályzat és ügyfél-átvilágítási dokumentáció', 'LEGAL'),

  familyEmployment: T('F01', 'Családtagok foglalkoztatása, juttatásai és tulajdonosi szerepe', 'HR'),
  groupChart: T('F02', 'Csoportszerkezet (kapcsolt vállalkozások ábrája)', 'LEGAL'),
  devContracts: T('F03', 'Fejlesztői és alkotói szerződések (vagyoni jogok átruházása)', 'LEGAL'),
  contractorFull: T('F04', 'Megbízotti / vállalkozói szerződések teljes köre (munkarend, eszközök, díjazás)', 'HR'),
  realEstate: T('F05', 'Tulajdoni lapok, bérleti szerződések', 'LEGAL'),
  publicContracts: T('F06', 'Közbeszerzési szerződések (kötbér, garancia, fizetési feltételek)', 'LEGAL'),
  fx: T('F07', 'Külföldi ügyletek és devizakitettség kimutatása', 'FINANCE'),
  gdpr: T('F08', 'Adatkezelési nyilvántartás és adatfeldolgozói szerződések', 'LEGAL'),
  litigationFiles: T('F09', 'A jogviták iratai (keresetlevél, ügyvédi levél, becsült kimenetel)', 'LEGAL'),
  whistleblowing: T('Z01', 'Belső visszaélés-bejelentési rendszer szabályzata', 'LEGAL'),
  worktime: T('Z02', 'Munkaidő-nyilvántartás (minta hónap), túlóra-elszámolás', 'HR'),
  benefits: T('Z03', 'Juttatási / cafeteria- és bérszabályzat', 'HR'),
} satisfies Record<string, Template>;

const BASE: Template[] = [
  DOCS.companyExtract,
  DOCS.articles,
  DOCS.statements,
  DOCS.trialBalance,
  DOCS.arAging,
  DOCS.salesByCustomer,
  DOCS.purchases,
  DOCS.topContracts,
  DOCS.loans,
  DOCS.taxReturns,
  DOCS.headcount,
  DOCS.employmentForms,
  DOCS.litigationList,
  DOCS.insurance,
  DOCS.relatedParty,
];

type Rule = { doc: Template; why: string; required?: boolean };

const BY_KIND: Record<EngagementKind, Rule[]> = {
  HEALTH_CHECK: [
    { doc: DOCS.businessPlan, why: 'a vezetői döntéshozatal és tervezés felméréséhez' },
    { doc: DOCS.mgmtReport, why: 'a vezetői információs rendszer felméréséhez' },
  ],
  VENDOR_DD: [
    { doc: DOCS.dataRoomIndex, why: 'a vevői átvilágításra való felkészültség felméréséhez', required: true },
    { doc: DOCS.ipRegister, why: 'a vevő az eszközök jogcímét ellenőrzi' },
    { doc: DOCS.permitList, why: 'a működés folytonossága tulajdonosváltás után' },
    { doc: DOCS.contingent, why: 'a vevő a függő kötelezettségeket beárazza' },
  ],
  BUY_SIDE_DD: [
    { doc: DOCS.termSheet, why: 'a vételár-mechanizmus és a garanciák összevetése a feltárt kockázatokkal', required: true },
    { doc: DOCS.contingent, why: 'rejtett kötelezettségek feltárása', required: true },
    { doc: DOCS.ipRegister, why: 'a megvásárolt eszközök jogcíme' },
  ],
  FINANCING_READINESS: [
    { doc: DOCS.cashflowPlan, why: 'a bank ezt kéri elsőként', required: true },
    { doc: DOCS.covenants, why: 'a meglévő hitelek feltételeinek teljesítése', required: true },
    { doc: DOCS.interim, why: 'friss számokon alapuló hitelképesség' },
    { doc: DOCS.guarantees, why: 'a garanciakeret kihasználtsága' },
  ],
  SUCCESSION: [
    { doc: DOCS.ownersAgreement, why: 'az üzletrész-átadás, kiválás és vita szabályai', required: true },
    { doc: DOCS.ownerLoans, why: 'az átadás előtt rendezendő tulajdonosi tételek', required: true },
    { doc: DOCS.keyPeopleContracts, why: 'a kulcsemberek megtartása a generációváltás alatt', required: true },
    { doc: DOCS.successionPlan, why: 'a meglévő elképzelések és döntések rögzítése' },
    { doc: DOCS.clientOwnership, why: 'mennyire kötődnek az ügyfelek személyesen az átadóhoz' },
    { doc: DOCS.privateAssets, why: 'a cég és a család vagyonának szétválasztása' },
  ],
  COMPLIANCE_AUDIT: [
    { doc: DOCS.policies, why: 'a kötelező szabályzatok megléte és naprakészsége', required: true },
    { doc: DOCS.inspections, why: 'a korábbi hatósági megállapítások és azok rendezése', required: true },
    { doc: DOCS.permitList, why: 'a működési engedélyek érvényessége' },
  ],
  POST_MERGER: [
    { doc: DOCS.orgChart, why: 'a kulcspozíciók és az átfedések feltérképezése', required: true },
    { doc: DOCS.itSystems, why: 'a párhuzamos rendszerek összevezetése', required: true },
    { doc: DOCS.retention, why: 'a kulcsemberek megtartása az integráció alatt' },
  ],
};

const BY_SECTOR: Record<Sector, Rule[]> = {
  CONSULTING: [
    { doc: DOCS.clientTemplates, why: 'a bevétel szerződéses alapja, felelősség és felmondás', required: true },
    { doc: DOCS.pi, why: 'szakmai hiba esetére fennálló fedezet', required: true },
    { doc: DOCS.projectRevenue, why: 'ügyfél- és munkatárs-koncentráció, kihasználtság' },
    { doc: DOCS.subcontracts, why: 'a szakértők jogviszonya és a tudás elhelyezkedése' },
    { doc: DOCS.qualifications, why: 'ha a tevékenység képesítéshez kötött, a jogosultság ne egy emberen múljon' },
  ],
  IT: [
    { doc: DOCS.sourceCode, why: 'a termék jogcíme és a licenckockázat', required: true },
    { doc: DOCS.devContracts, why: 'a fejlesztők vagyoni jogainak átruházása', required: true },
    { doc: DOCS.sla, why: 'felelősség és kötbér az ügyfelek felé' },
    { doc: DOCS.infosec, why: 'üzemfolytonosság és adatbiztonság' },
  ],
  CONSTRUCTION: [
    { doc: DOCS.projects, why: 'futó kötbér- és garanciakockázat', required: true },
    { doc: DOCS.guarantees, why: 'a garanciaállomány és a bankkapcsolat', required: true },
    { doc: DOCS.hse, why: 'munkavédelmi felelősség' },
  ],
  MANUFACTURING: [
    { doc: DOCS.envPermits, why: 'a termelés jogi feltétele', required: true },
    { doc: DOCS.assets, why: 'a gépállomány kora és a beruházási igény' },
    { doc: DOCS.certificates, why: 'a vevői követelmények teljesítése' },
    { doc: DOCS.supplyContracts, why: 'ellátásbiztonság és árkockázat' },
  ],
  TRADE: [
    { doc: DOCS.supplyContracts, why: 'forgalmazói jogok és beszerzési feltételek', required: true },
    { doc: DOCS.inventory, why: 'készletértékelés és elfekvő készlet' },
  ],
  ACCOUNTING: [
    { doc: DOCS.clientTemplates, why: 'díjazás, indexálás és felelősségkorlátozás az ügyfélszerződésekben', required: true },
    { doc: DOCS.pi, why: 'szakmai felelősségbiztosítás limitje', required: true },
    { doc: DOCS.aml, why: 'pénzmosás elleni kötelezettségek', required: true },
    { doc: DOCS.qualifications, why: 'regisztrált mérlegképes és adótanácsadói jogosultságok' },
  ],
  OTHER: [],
};

const BY_FLAG: Record<CaseFlag, Rule[]> = {
  MULTIPLE_OWNERS: [{ doc: DOCS.ownersAgreement, why: 'több tulajdonos: kiválás, vita és átruházás szabályai', required: true }],
  FAMILY: [
    { doc: DOCS.familyEmployment, why: 'családi cég: családtagok szerepe és juttatásai' },
    { doc: DOCS.privateAssets, why: 'családi cég: céges és magánvagyon elválasztása' },
  ],
  RELATED_PARTIES: [
    { doc: DOCS.relatedParty, why: 'kapcsolt ügyletek: transzferár-kockázat', required: true },
    { doc: DOCS.groupChart, why: 'kapcsolt vállalkozások köre' },
  ],
  OWN_IP: [
    { doc: DOCS.ipRegister, why: 'saját szellemi tulajdon nyilvántartása', required: true },
    { doc: DOCS.devContracts, why: 'a vagyoni jogok átruházása az alkotóktól', required: true },
  ],
  CONTRACTORS: [{ doc: DOCS.contractorFull, why: 'számlás munkatársak: átminősítési kockázat', required: true }],
  REAL_ESTATE: [{ doc: DOCS.realEstate, why: 'ingatlanhasználat jogcíme és feltételei' }],
  PERMITS: [{ doc: DOCS.permitList, why: 'engedélyköteles tevékenység', required: true }],
  PUBLIC_PROCUREMENT: [{ doc: DOCS.publicContracts, why: 'közbeszerzési kötbér, garancia, lassú fizetés', required: true }],
  BANK_FINANCING: [
    { doc: DOCS.loans, why: 'banki finanszírozás: feltételek', required: true },
    { doc: DOCS.covenants, why: 'banki finanszírozás: kovenánsok teljesítése' },
  ],
  FOREIGN: [{ doc: DOCS.fx, why: 'devizakockázat és határon átnyúló ügyletek' }],
  PERSONAL_DATA: [{ doc: DOCS.gdpr, why: 'sok személyes adat: adatvédelmi megfelelés', required: true }],
  KEY_CLIENTS: [
    { doc: DOCS.topContracts, why: 'kulcsügyfelek: felmondás és Change of Control', required: true },
    { doc: DOCS.clientOwnership, why: 'kulcsügyfelek: kihez kötődik a kapcsolat' },
  ],
  LITIGATION: [{ doc: DOCS.litigationFiles, why: 'jogvita: kitettség becsléséhez', required: true }],
};

function sizeRules(headcount: number | null): Rule[] {
  if (headcount == null) return [];
  const out: Rule[] = [];
  if (headcount >= 10) {
    out.push({ doc: DOCS.worktime, why: `${headcount} fő: munkaidő- és túlóra-nyilvántartás` });
    out.push({ doc: DOCS.benefits, why: `${headcount} fő: juttatási és bérgyakorlat` });
  }
  if (headcount >= 50) {
    out.push({ doc: DOCS.whistleblowing, why: '50 fő felett kötelező belső visszaélés-bejelentési rendszer', required: true });
  }
  return out;
}

/** A tényállásból és a célból összeállított iratlista (ismétlés nélkül, indokokkal). */
export function buildRequestList(profile: CaseProfile, kind: EngagementKind): DocRequest[] {
  const out = new Map<string, DocRequest>();
  const add = (doc: Template, source: RequestSource, why: string, required: boolean) => {
    const cur = out.get(doc.id);
    if (cur) {
      if (!cur.why.includes(why)) cur.why.push(why);
      if (required) cur.priority = 'REQUIRED';
      return;
    }
    out.set(doc.id, {
      id: doc.id,
      title: doc.title,
      pillar: doc.pillar,
      table: doc.table,
      why: [why],
      source,
      priority: required ? 'REQUIRED' : 'RECOMMENDED',
    });
  };
  for (const d of BASE) add(d, 'BASE', 'minden átvilágításnál bekérjük', true);
  const kindLabel = ENGAGEMENT_KINDS[kind].label;
  for (const r of BY_KIND[kind]) add(r.doc, 'KIND', `${kindLabel}: ${r.why}`, Boolean(r.required));
  for (const s of profile.sectors) for (const r of BY_SECTOR[s]) add(r.doc, 'SECTOR', `${SECTOR_LABEL[s]}: ${r.why}`, Boolean(r.required));
  for (const r of sizeRules(profile.headcount)) add(r.doc, 'SIZE', r.why, Boolean(r.required));
  for (const f of profile.flags) for (const r of BY_FLAG[f]) add(r.doc, 'FLAG', r.why, Boolean(r.required));
  return [...out.values()];
}

export type RequestStatus = 'REQUESTED' | 'RECEIVED' | 'MISSING' | 'NA';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  REQUESTED: 'Bekérve',
  RECEIVED: 'Beérkezett',
  MISSING: 'Hiányzik',
  NA: 'Nem releváns',
};

/** Az ügyfélnek küldhető iratlista szövege (e-mailbe másolható). */
export function requestListText(companyName: string, list: DocRequest[], statuses: Record<string, RequestStatus>): string {
  const open = list.filter((d) => (statuses[d.id] ?? 'REQUESTED') !== 'RECEIVED' && statuses[d.id] !== 'NA');
  const lines = (prio: DocRequest['priority']) => open.filter((d) => d.priority === prio).map((d, i) => `${i + 1}. ${d.title}`);
  const req = lines('REQUIRED');
  const rec = lines('RECOMMENDED');
  return [
    `Iratbekérés – ${companyName}`,
    '',
    'Kérjük, az alábbi dokumentumokat szíveskedjenek rendelkezésünkre bocsátani:',
    '',
    ...(req.length ? ['Kötelező:', ...req, ''] : []),
    ...(rec.length ? ['Ha rendelkezésre áll:', ...rec, ''] : []),
    'A táblázatokat Excel- vagy CSV-formátumban kérjük. Személyes adatot (név, adóazonosító) csak ott küldjenek, ahol kifejezetten kérjük; a létszámkimutatás álnevesítve is megfelelő.',
  ].join('\n');
}
