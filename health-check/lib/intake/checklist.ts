import type { EngagementKind } from '@/lib/engagement/kinds';
import type { KnownFact } from '@/lib/interview/types';
import type { Pillar, Scale5 } from '@/lib/risk/types';
import { templateFor } from './apply';
import type { IntakeResult, IntakeSuggestion, ValuationPatch } from './types';

/**
 * Ügyfélkérdőív (30 kérdés) és szabályalapú előjelölés.
 *
 * A szabályok adatként vannak megadva (nem kódként), így élesben a
 * `checklist_questions.flag_rule` / `flag_template_code` oszlopokból is
 * betölthetők, és a partner a kód módosítása nélkül hangolhatja őket.
 * AI nincs benne: ugyanarra a válaszra mindig ugyanaz a javaslat.
 */

export type Answer = boolean | number | string;
export type ChecklistAnswers = Record<string, Answer>;

export type Condition = { equals: boolean | string } | { gte: number } | { in: string[] };

export interface FlagRule {
  when: Condition;
  /** Tételkód; null = új egyedi tétel (`title` kötelező). */
  code: string | null;
  /** Átvilágítás-típusonként más tétel illik (pl. finanszírozásnál FIK-02). */
  codeByKind?: Partial<Record<EngagementKind, string>>;
  title?: string;
  likelihood: Scale5;
  impact: Scale5;
  /** Százalékos válasz → árbevétel-arány; darabszám → tételszám a képletben. */
  valuationFromAnswer?: 'SHARE' | 'COUNT';
  /** Miért jelez a szabály – a szakértő ezt látja. */
  note: string;
}

export interface ChecklistQuestion {
  id: string;
  pillar: Pillar;
  text: string;
  help?: string;
  /** Rövid címke a tényhez: „Transzferár-nyilvántartás teljes”. */
  short: string;
  type: 'YES_NO' | 'PERCENT' | 'NUMBER' | 'CHOICE';
  unit?: string;
  choices?: { value: string; label: string }[];
  /** Csak akkor jelenik meg (és számít), ha az előző válasz ezt indokolja. */
  showIf?: { question: string; when: Condition };
  rules: FlagRule[];
  /** Az ügyféltől ehhez kért dokumentum. */
  document?: string;
}

const IGEN_RESZBEN_NEM = [
  { value: 'IGEN', label: 'Igen, mindenhol' },
  { value: 'RESZBEN', label: 'Részben' },
  { value: 'NEM', label: 'Nem' },
];

export const CHECKLIST: ChecklistQuestion[] = [
  // ── Pénzügy / Adó ───────────────────────────────────────────────
  {
    id: 'Q01', pillar: 'FINANCE', type: 'YES_NO', short: 'Transzferár-nyilvántartás teljes',
    text: 'Elkészült a transzferár-nyilvántartás minden 50 M Ft feletti kapcsolt ügyletre az elmúlt 2 évben?',
    help: 'Kapcsolt fél: tulajdonos, közös tulajdonú cég, vezető tisztségviselő cége.',
    rules: [{ when: { equals: false }, code: 'FIN-01', likelihood: 4, impact: 3, note: 'Hiányzó nyilvántartás: mulasztási bírság, a piaci ár bizonyítása a társaságra hárul.' }],
    document: 'Kapcsolt ügyletek listája és transzferár-nyilvántartások',
  },
  {
    id: 'Q02', pillar: 'FINANCE', type: 'NUMBER', unit: 'db', short: 'Hiányzó transzferár-nyilvántartások száma',
    text: 'Hány kapcsolt ügylethez hiányzik a nyilvántartás?',
    showIf: { question: 'Q01', when: { equals: false } },
    rules: [
      { when: { gte: 1 }, code: 'FIN-01', likelihood: 4, impact: 3, valuationFromAnswer: 'COUNT', note: 'A kitettség a hiányzó nyilvántartások számával arányos.' },
      { when: { gte: 3 }, code: 'FIN-01', likelihood: 4, impact: 4, valuationFromAnswer: 'COUNT', note: 'Három vagy több hiányzó nyilvántartás: rendszerszintű hiányosság.' },
    ],
  },
  {
    id: 'Q03', pillar: 'FINANCE', type: 'YES_NO', short: 'Tulajdonosi magánjellegű költségek az eredményben',
    text: 'Szerepelnek az eredményben tulajdonosi, magánjellegű költségek (autó, utazás, családtag bére)?',
    rules: [{ when: { equals: true }, code: 'FIN-02', likelihood: 4, impact: 3, note: 'Az EBITDA normalizálást igényel; a vevő / bank ezt korrigálja.' }],
  },
  {
    id: 'Q04', pillar: 'FINANCE', type: 'YES_NO', short: 'Jelentős egyszeri tétel az elmúlt 2 évben',
    text: 'Volt az elmúlt 2 évben az árbevétel 5%-át meghaladó egyszeri bevétel vagy ráfordítás (ingatlaneladás, per, támogatás)?',
    rules: [{ when: { equals: true }, code: 'FIN-02', likelihood: 3, impact: 3, note: 'Egyszeri tétel torzítja a fenntartható eredményt.' }],
  },
  {
    id: 'Q05', pillar: 'FINANCE', type: 'PERCENT', unit: '%', short: '90 napon túl lejárt vevőállomány aránya',
    text: 'A vevőállomány hány százaléka 90 napon túl lejárt?',
    help: 'Ha van vevői korosítás, az Adattáblák fülön pontosabb számítás készül belőle.',
    rules: [
      { when: { gte: 15 }, code: 'FIN-03', likelihood: 3, impact: 3, note: '15% feletti lejárt állomány: lekötött forgótőke, értékvesztési kockázat.' },
      { when: { gte: 30 }, code: 'FIN-03', likelihood: 4, impact: 4, note: '30% feletti lejárt állomány: likviditási kockázat.' },
    ],
    document: 'Vevői korosítás a fordulónapra',
  },
  {
    id: 'Q06', pillar: 'FINANCE', type: 'YES_NO', short: 'Havi ÁFA-egyeztetés a NAV online számla adataival',
    text: 'Egyeztetik havonta az ÁFA-analitikát a NAV online számla adataival?',
    rules: [{ when: { equals: false }, code: 'FIN-04', likelihood: 3, impact: 4, note: 'Egyeztetés nélkül az eltérés csak ellenőrzéskor derül ki.' }],
  },
  {
    id: 'Q07', pillar: 'FINANCE', type: 'YES_NO', short: '5 M Ft feletti adókülönbözet az elmúlt 3 évben',
    text: 'Tárt fel NAV-ellenőrzés vagy önellenőrzés 5 M Ft feletti különbözetet az elmúlt 3 évben?',
    rules: [{ when: { equals: true }, code: 'FIN-04', likelihood: 4, impact: 4, note: 'Korábbi jelentős különbözet: a kontrollhiány valószínűleg fennáll.' }],
  },
  {
    id: 'Q08', pillar: 'FINANCE', type: 'YES_NO', short: 'Legalább 12 hónapos cash-flow előrejelzés készül',
    text: 'Készül legalább 12 hónapos cash-flow előrejelzés?',
    rules: [{
      when: { equals: false }, code: 'HC-02', codeByKind: { FINANCING_READINESS: 'FIK-02' },
      likelihood: 3, impact: 3, note: 'Likviditási terv nélkül a finanszírozási igény későn derül ki.',
    }],
  },
  // ── Jog ─────────────────────────────────────────────────────────
  {
    id: 'Q09', pillar: 'LEGAL', type: 'CHOICE', short: 'Change of Control záradék a top 10 szerződésben',
    text: 'Enged valamelyik top 10 vevői vagy szállítói szerződés felmondást tulajdonosváltáskor (Change of Control)?',
    choices: [
      { value: 'IGEN', label: 'Igen' },
      { value: 'NEM', label: 'Nem' },
      { value: 'NEM_TUDJUK', label: 'Nem tudjuk' },
    ],
    rules: [
      { when: { equals: 'IGEN' }, code: 'LEG-01', likelihood: 3, impact: 4, note: 'Tranzakció vagy befektető belépése esetén a partner kiléphet.' },
      { when: { equals: 'NEM_TUDJUK' }, code: 'LEG-01', likelihood: 2, impact: 4, note: 'Ismeretlen: a szerződéseket át kell nézni (Dokumentumok fül).' },
    ],
    document: 'Top 10 vevői és szállítói szerződés',
  },
  {
    id: 'Q10', pillar: 'LEGAL', type: 'PERCENT', unit: '%', short: 'CoC-záradékkal érintett partnerek árbevétel-aránya',
    text: 'Az érintett partnerek az árbevétel hány százalékát adják?',
    showIf: { question: 'Q09', when: { equals: 'IGEN' } },
    rules: [
      { when: { gte: 1 }, code: 'LEG-01', likelihood: 3, impact: 4, valuationFromAnswer: 'SHARE', note: 'A kitettség az érintett árbevétel fedezete.' },
      { when: { gte: 25 }, code: 'LEG-01', likelihood: 3, impact: 5, valuationFromAnswer: 'SHARE', note: 'Az árbevétel negyedét meghaladó érintettség kritikus.' },
    ],
  },
  {
    id: 'Q11', pillar: 'LEGAL', type: 'CHOICE', short: 'Szellemi tulajdon átruházása fejlesztői szerződésekben',
    text: 'Tartalmazza minden fejlesztő, tervező, alvállalkozó szerződése a szellemi tulajdon átruházását (vagy kizárólagos felhasználási jogot)?',
    choices: [...IGEN_RESZBEN_NEM, { value: 'NINCS', label: 'Nincs ilyen munka' }],
    rules: [
      { when: { equals: 'RESZBEN' }, code: 'LEG-02', likelihood: 3, impact: 4, note: 'Egyes művek jogai nem a társaságnál vannak.' },
      { when: { equals: 'NEM' }, code: 'LEG-02', likelihood: 4, impact: 4, note: 'A kulcsfontosságú szellemi tulajdon jogcíme nem igazolható.' },
    ],
    document: 'Fejlesztői és alvállalkozói szerződések',
  },
  {
    id: 'Q12', pillar: 'LEGAL', type: 'YES_NO', short: 'Létesítő okirat megfelel a tényleges működésnek',
    text: 'Megfelel a hatályos létesítő okirat és a cégkivonat a tényleges működésnek (képviselet, tevékenység, tulajdonosok)?',
    rules: [{ when: { equals: false }, code: 'LEG-03', likelihood: 3, impact: 2, note: 'Eltérés esetén tranzakciónál vagy finanszírozásnál késedelem.' }],
    document: 'Hatályos létesítő okirat, cégkivonat',
  },
  {
    id: 'Q13', pillar: 'LEGAL', type: 'YES_NO', short: 'Adatkezelési nyilvántartás van',
    text: 'Van a GDPR szerinti adatkezelési nyilvántartás (a rendelet 30. cikke)?',
    rules: [{ when: { equals: false }, code: 'LEG-04', likelihood: 3, impact: 3, note: 'Kötelező nyilvántartás hiánya; hatósági bírság kockázata.' }],
  },
  {
    id: 'Q14', pillar: 'LEGAL', type: 'CHOICE', short: 'Adatfeldolgozói szerződések megvannak',
    text: 'Megvannak az adatfeldolgozói szerződések (bérszámfejtő, felhőszolgáltató, CRM)?',
    choices: IGEN_RESZBEN_NEM,
    rules: [
      { when: { equals: 'RESZBEN' }, code: 'LEG-04', likelihood: 3, impact: 3, note: 'Hiányos adatfeldolgozói szerződések.' },
      { when: { equals: 'NEM' }, code: 'LEG-04', likelihood: 4, impact: 3, note: 'Adatfeldolgozói szerződések nélkül minden adattovábbítás jogalap nélküli.' },
    ],
  },
  {
    id: 'Q15', pillar: 'LEGAL', type: 'YES_NO', short: '10 M Ft feletti per vagy hatósági eljárás',
    text: 'Van folyamatban lévő vagy fenyegető per, hatósági eljárás 10 M Ft felett?',
    rules: [{
      when: { equals: true }, code: null, title: 'Folyamatban lévő per vagy hatósági eljárás',
      likelihood: 3, impact: 4, note: 'Függő kötelezettség; céltartalék és tájékoztatási kötelezettség vizsgálandó.',
    }],
    document: 'Perek és hatósági eljárások listája',
  },
  {
    id: 'Q16', pillar: 'LEGAL', type: 'CHOICE', short: 'Írásos tulajdonosi megállapodás',
    text: 'Több tulajdonos esetén van írásos tulajdonosi (szindikátusi) megállapodás?',
    choices: [
      { value: 'IGEN', label: 'Igen' },
      { value: 'NEM', label: 'Nem' },
      { value: 'EGY', label: 'Egy tulajdonos van' },
    ],
    rules: [{ when: { equals: 'NEM' }, code: 'SUC-01', likelihood: 3, impact: 4, note: 'Kilépés, halál, vita esetére nincs rendezett szabály.' }],
  },
  // ── Operáció ────────────────────────────────────────────────────
  {
    id: 'Q17', pillar: 'OPERATIONS', type: 'PERCENT', unit: '%', short: 'Legnagyobb beszállító aránya a beszerzésben',
    text: 'A legnagyobb beszállító a beszerzések hány százalékát adja?',
    rules: [
      { when: { gte: 40 }, code: 'OPS-01', likelihood: 3, impact: 4, note: '40% feletti beszállítói koncentráció.' },
      { when: { gte: 60 }, code: 'OPS-01', likelihood: 4, impact: 4, note: '60% feletti koncentráció: az ellátás egy partneren múlik.' },
    ],
    document: 'Szállítónkénti beszerzési lista (12 hónap)',
  },
  {
    id: 'Q18', pillar: 'OPERATIONS', type: 'YES_NO', short: 'Keretszerződés a legnagyobb beszállítóval',
    text: 'Van keretszerződés a legnagyobb beszállítóval, ár- és ellátási garanciával?',
    rules: [{ when: { equals: false }, code: 'OPS-01', likelihood: 2, impact: 3, note: 'Keretszerződés nélkül az ár és az ellátás egyoldalúan változhat.' }],
  },
  {
    id: 'Q19', pillar: 'OPERATIONS', type: 'CHOICE', short: 'Az ügyviteli rendszer gyártói támogatása',
    text: 'Támogatja még a gyártó az ügyviteli (ERP) rendszert?',
    choices: [
      { value: 'IGEN', label: 'Igen' },
      { value: 'NEM', label: 'Nem, támogatás nélkül fut' },
      { value: 'EGYEDI', label: 'Saját fejlesztés, dokumentáció nélkül' },
    ],
    rules: [
      { when: { equals: 'NEM' }, code: 'OPS-02', likelihood: 4, impact: 3, note: 'Támogatás nélküli rendszer: üzemzavar és biztonsági rés kockázata.' },
      { when: { equals: 'EGYEDI' }, code: 'OPS-02', likelihood: 3, impact: 3, note: 'Dokumentálatlan egyedi rendszer: egy-két emberen múlik.' },
    ],
  },
  {
    id: 'Q20', pillar: 'OPERATIONS', type: 'CHOICE', short: 'Üzletmenet-folytonossági terv és tesztelt mentés',
    text: 'Van írásos üzletmenet-folytonossági terv és tesztelt mentés-visszaállítás?',
    choices: [
      { value: 'IGEN', label: 'Mindkettő van' },
      { value: 'MENTES', label: 'Csak tesztelt mentés' },
      { value: 'NEM', label: 'Nincs' },
    ],
    rules: [
      { when: { equals: 'MENTES' }, code: 'OPS-03', likelihood: 2, impact: 4, note: 'Mentés van, de a kiesés kezelése nincs megtervezve.' },
      { when: { equals: 'NEM' }, code: 'OPS-03', likelihood: 3, impact: 4, note: 'Sem terv, sem tesztelt visszaállítás.' },
    ],
  },
  {
    id: 'Q21', pillar: 'OPERATIONS', type: 'YES_NO', short: 'Működési engedély jár le 6 hónapon belül',
    text: 'Lejár 6 hónapon belül a működéshez szükséges engedély (telephely, környezetvédelem, tűzvédelem)?',
    rules: [{ when: { equals: true }, code: 'OPS-04', likelihood: 3, impact: 3, note: 'Megújítás nélkül a tevékenység korlátozható.' }],
    document: 'Engedélyek listája lejárattal',
  },
  {
    id: 'Q22', pillar: 'OPERATIONS', type: 'PERCENT', unit: '%', short: 'Legnagyobb vevő aránya az árbevételben',
    text: 'A legnagyobb vevő az árbevétel hány százalékát adja?',
    rules: [
      { when: { gte: 25 }, code: 'OPS-05', likelihood: 3, impact: 4, valuationFromAnswer: 'SHARE', note: '25% feletti vevőkoncentráció.' },
      { when: { gte: 40 }, code: 'OPS-05', likelihood: 3, impact: 5, valuationFromAnswer: 'SHARE', note: '40% feletti vevőkoncentráció: a cég egy vevőn múlik.' },
    ],
    document: 'Vevőnkénti árbevétel (12 hónap)',
  },
  {
    id: 'Q23', pillar: 'OPERATIONS', type: 'YES_NO', short: 'Írásos üzleti terv és havi vezetői riport',
    text: 'Van írásos éves üzleti terv és havi vezetői riport?',
    rules: [{ when: { equals: false }, code: 'HC-01', likelihood: 3, impact: 3, note: 'A vezetés számszerű visszajelzés nélkül dönt.' }],
  },
  // ── HR ──────────────────────────────────────────────────────────
  {
    id: 'Q24', pillar: 'HR', type: 'YES_NO', short: 'Van kulcsember, akinek távozása a bevétel 30%-át veszélyezteti',
    text: 'Van olyan vezető vagy munkatárs, akinek távozása az árbevétel legalább 30%-át veszélyeztetné?',
    rules: [{ when: { equals: true }, code: 'HR-01', likelihood: 3, impact: 5, note: 'Kulcsember-függőség.' }],
  },
  {
    id: 'Q25', pillar: 'HR', type: 'PERCENT', unit: '%', short: 'Kulcsemberhez kötött árbevétel aránya',
    text: 'Az ő ügyfeleihez vagy munkájához kötött árbevétel aránya?',
    showIf: { question: 'Q24', when: { equals: true } },
    rules: [{ when: { gte: 1 }, code: 'HR-01', likelihood: 3, impact: 5, valuationFromAnswer: 'SHARE', note: 'A kitettség a kulcsemberhez kötött árbevétel fedezete.' }],
  },
  {
    id: 'Q26', pillar: 'HR', type: 'CHOICE', short: 'Kulcsember helyettese és megtartási megállapodása',
    text: 'Van kijelölt, felkészített helyettese, illetve versenytilalmi / megtartási megállapodása?',
    showIf: { question: 'Q24', when: { equals: true } },
    choices: IGEN_RESZBEN_NEM,
    rules: [
      { when: { equals: 'RESZBEN' }, code: 'HR-01', likelihood: 3, impact: 5, note: 'Részleges védelem.' },
      { when: { equals: 'NEM' }, code: 'HR-01', likelihood: 4, impact: 5, note: 'Sem helyettes, sem megtartási megállapodás.' },
    ],
  },
  {
    id: 'Q27', pillar: 'HR', type: 'NUMBER', unit: 'fő', short: 'Munkaviszony jellegű megbízásos / számlás foglalkoztatottak',
    text: 'Hány fő dolgozik megbízási vagy számlás konstrukcióban munkaviszony jellegű feladaton (fix munkaidő, egy megbízó, utasítás)?',
    rules: [
      { when: { gte: 1 }, code: 'HR-02', likelihood: 3, impact: 3, note: 'Átminősítési kockázat.' },
      { when: { gte: 3 }, code: 'HR-02', likelihood: 3, impact: 4, note: 'Több érintett: visszamenőleges közteher jelentős lehet.' },
      { when: { gte: 10 }, code: 'HR-02', likelihood: 4, impact: 4, note: 'Tömeges gyakorlat: ellenőrzésnél szinte biztos megállapítás.' },
    ],
    document: 'Megbízási és vállalkozói szerződések listája',
  },
  {
    id: 'Q28', pillar: 'HR', type: 'YES_NO', short: 'Munkaidő-nyilvántartás rögzíti a túlórát és a pihenőidőt',
    text: 'Van munkaidő-nyilvántartás, amely a túlórát és a pihenőidőt is rögzíti?',
    rules: [{ when: { equals: false }, code: 'HR-03', likelihood: 3, impact: 2, note: 'Munkaügyi ellenőrzésnél bírság, perben bérkülönbözet.' }],
  },
  {
    id: 'Q29', pillar: 'HR', type: 'PERCENT', unit: '%', short: 'Fluktuáció a kulcspozíciókban (12 hónap)',
    text: 'Mekkora volt a fluktuáció a kulcspozíciókban az elmúlt 12 hónapban?',
    rules: [
      { when: { gte: 25 }, code: 'HR-04', likelihood: 3, impact: 3, note: '25% feletti fluktuáció.' },
      { when: { gte: 40 }, code: 'HR-04', likelihood: 4, impact: 3, note: '40% feletti fluktuáció: tudásvesztés.' },
    ],
  },
  {
    id: 'Q30', pillar: 'HR', type: 'YES_NO', short: 'Munkaügyi ellenőrzés vagy per az elmúlt 3 évben',
    text: 'Volt munkaügyi ellenőrzés vagy munkavállalói per az elmúlt 3 évben?',
    rules: [{ when: { equals: true }, code: 'HR-03', likelihood: 3, impact: 3, note: 'Korábbi munkaügyi eljárás: a hatóság ismeri a céget.' }],
  },
];

const BY_ID = new Map(CHECKLIST.map((q) => [q.id, q]));

function matches(c: Condition, a: Answer | undefined): boolean {
  if (a === undefined || a === '') return false;
  if ('equals' in c) return a === c.equals;
  if ('gte' in c) return typeof a === 'number' && a >= c.gte;
  return typeof a === 'string' && c.in.includes(a);
}

export function isVisible(q: ChecklistQuestion, answers: ChecklistAnswers): boolean {
  if (!q.showIf) return true;
  const parent = BY_ID.get(q.showIf.question);
  return Boolean(parent && isVisible(parent, answers) && matches(q.showIf.when, answers[q.showIf.question]));
}

export function formatAnswer(q: ChecklistQuestion, a: Answer | undefined): string {
  if (a === undefined || a === '') return '—';
  if (typeof a === 'boolean') return a ? 'Igen' : 'Nem';
  if (typeof a === 'number') return `${a.toLocaleString('hu-HU')}${q.unit ? (q.unit === '%' ? '%' : ` ${q.unit}`) : ''}`;
  return q.choices?.find((c) => c.value === a)?.label ?? a;
}

export function checklistProgress(answers: ChecklistAnswers): { answered: number; total: number } {
  const visible = CHECKLIST.filter((q) => isVisible(q, answers));
  return { answered: visible.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length, total: visible.length };
}

interface Hit { q: ChecklistQuestion; rule: FlagRule; code: string | null }

/**
 * Válaszok → javaslatok. Egy tételre több szabály is illeszkedhet:
 * a legsúlyosabb valószínűség és hatás érvényes, a bizonyíték összeadódik.
 */
export function evaluateChecklist(answers: ChecklistAnswers, kind: EngagementKind): IntakeResult {
  const hits: Hit[] = [];
  const facts: KnownFact[] = [];
  for (const q of CHECKLIST) {
    if (!isVisible(q, answers)) continue;
    const a = answers[q.id];
    if (a === undefined || a === '') continue;
    facts.push({
      id: `CHK-${q.id}`,
      pillar: q.pillar,
      statement: `${q.short}: ${formatAnswer(q, a)}`,
      source: `Ügyfélkérdőív, ${q.id}`,
      askInInterview: false,
    });
    for (const rule of q.rules) {
      if (matches(rule.when, a)) hits.push({ q, rule, code: rule.codeByKind?.[kind] ?? rule.code });
    }
  }

  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const k = h.code ?? `NEW:${h.rule.title}`;
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }

  const suggestions: IntakeSuggestion[] = [];
  for (const [groupKey, hs] of groups) {
    const first = hs[0];
    const code = first.code;
    const template = code ? templateFor(code) : undefined;
    const likelihood = Math.max(...hs.map((h) => h.rule.likelihood)) as Scale5;
    const impact = Math.max(...hs.map((h) => h.rule.impact)) as Scale5;
    let valuationPatch: ValuationPatch | undefined;
    for (const h of hs) {
      const a = answers[h.q.id];
      if (typeof a !== 'number') continue;
      if (h.rule.valuationFromAnswer === 'SHARE') valuationPatch = { type: 'REVENUE_SHARE', share: a / 100 };
      if (h.rule.valuationFromAnswer === 'COUNT') valuationPatch = { type: 'PER_ITEM', count: a };
    }
    const questions = [...new Map(hs.map((h) => [h.q.id, h.q])).values()];
    const evidence = `Ügyfélkérdőív: ${questions.map((q) => `${q.id} ${q.short} – ${formatAnswer(q, answers[q.id])}`).join('; ')}`;
    const notes = [...new Set(hs.map((h) => h.rule.note))];
    const patchKey = valuationPatch ? (valuationPatch.type === 'REVENUE_SHARE' ? valuationPatch.share : valuationPatch.count) : '';
    suggestions.push({
      key: `CHK:${groupKey}:${likelihood}${impact}:${patchKey}`,
      origin: 'CHECKLIST',
      code,
      pillar: template?.pillar ?? first.q.pillar,
      title: template?.title ?? first.rule.title ?? first.q.short,
      rationale: notes.join(' '),
      evidence,
      likelihood,
      impact,
      valuationPatch,
    });
  }

  suggestions.sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);
  return { suggestions, companySuggestions: [], facts };
}

export function checklistQuestion(id: string): ChecklistQuestion | undefined {
  return BY_ID.get(id);
}
