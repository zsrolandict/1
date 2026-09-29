import { REMEDIATION_LABEL } from '@/lib/risk/followup';
import type { Pillar, RiskAssessment, ScoredRisk } from '@/lib/risk/types';

/**
 * Vevői kérdéslista eladói átvilágításhoz: a feltárt kockázatokból
 * „ezt fogja kérdezni a vevő”, válaszvázlattal és a szükséges iratokkal.
 * Szabály alapú kérdésbank (katalóguskód szerint); ismeretlen tételhez
 * pillérenkénti általános kérdés. TERVEZET – szakértői átnézésre.
 */

interface Entry {
  questions: string[];
  documents: string[];
}

const BANK: Record<string, Entry> = {
  'FIN-01': {
    questions: ['Elkészült-e minden kapcsolt ügyletre a transzferár-nyilvántartás az elmúlt 5 évre?', 'Volt-e transzferár-ellenőrzés vagy önellenőrzés?'],
    documents: ['Transzferár-nyilvántartások', 'Kapcsolt ügyletek listája', 'NAV-ellenőrzési jegyzőkönyvek'],
  },
  'FIN-02': {
    questions: ['Mely tételek egyszeriek vagy tulajdonosi jellegűek az EBITDA-ban?', 'Hogyan néz ki a normalizált EBITDA-híd?'],
    documents: ['Normalizált EBITDA-híd', 'Főkönyvi kivonat', 'Tulajdonosi juttatások kimutatása'],
  },
  'FIN-03': {
    questions: ['Mekkora a 90 és 180 napon túl lejárt vevőállomány, és ki a legnagyobb késedelmes vevő?', 'Van-e rá értékvesztés vagy behajtási eljárás?'],
    documents: ['Vevői korosítás', 'Értékvesztési szabályzat', 'Behajtási levelezés'],
  },
  'FIN-04': {
    questions: ['Egyeztetett-e az ÁFA-analitika a NAV online számla adataival?', 'Volt-e önellenőrzés vagy különbözet az elmúlt 3 évben?'],
    documents: ['ÁFA-egyeztetés', 'NAV-folyószámla', 'Önellenőrzések'],
  },
  'LEG-01': {
    questions: [
      'Mely szerződések tartalmaznak tulajdonosváltási (Change of Control) felmondási jogot?',
      'Beszerezhető-e a partnerek előzetes lemondó nyilatkozata (waiver) a zárás előtt?',
    ],
    documents: ['Érintett szerződések', 'Partneri lemondó nyilatkozatok', 'Érintett árbevétel kimutatása'],
  },
  'LEG-02': {
    questions: [
      'Minden fejlesztő és alkotó szerződése tartalmazza a vagyoni jogok átruházását?',
      'Ki a forráskód és a kulcsfontosságú szellemi tulajdon jogosultja?',
    ],
    documents: ['Fejlesztői és alvállalkozói szerződések', 'Jogátruházó nyilatkozatok', 'IP-nyilvántartás'],
  },
  'LEG-03': {
    questions: ['A létesítő okirat és a cégkivonat megfelel-e a tényleges működésnek?'],
    documents: ['Hatályos létesítő okirat', 'Cégkivonat', 'Taggyűlési határozatok'],
  },
  'LEG-04': {
    questions: ['Van-e adatkezelési nyilvántartás és adatfeldolgozói szerződés?', 'Volt-e adatvédelmi incidens vagy hatósági eljárás?'],
    documents: ['Adatkezelési nyilvántartás', 'Adatfeldolgozói szerződések', 'Incidensnapló'],
  },
  'OPS-01': {
    questions: ['Mekkora a legnagyobb beszállító aránya, és van-e alternatív forrás?', 'Milyen feltételekkel mondható fel a beszállítói kapcsolat?'],
    documents: ['Szállítónkénti beszerzés', 'Beszállítói keretszerződések'],
  },
  'OPS-02': {
    questions: ['Milyen ügyviteli rendszert használnak, és van-e gyártói támogatás?', 'Mekkora a várható csere- vagy fejlesztési igény?'],
    documents: ['IT-rendszerek listája', 'Licencszerződések', 'Fejlesztési terv'],
  },
  'OPS-03': {
    questions: ['Van-e üzletmenet-folytonossági terv és tesztelt mentés-visszaállítás?'],
    documents: ['BCP-dokumentáció', 'Visszaállítási teszt jegyzőkönyve'],
  },
  'OPS-04': {
    questions: ['Minden működési engedély érvényes, és ki felel a megújításért?'],
    documents: ['Engedélyek listája lejárattal'],
  },
  'OPS-05': {
    questions: ['Mekkora a legnagyobb vevők aránya, és milyen a szerződéses kötöttségük?', 'Milyen a vevőmegtartás az elmúlt 3 évben?'],
    documents: ['Vevőnkénti árbevétel', 'Kulcsvevői szerződések'],
  },
  'HR-01': {
    questions: [
      'Kiken múlik az árbevétel és a kulcskapcsolatok, és maradnak-e a tranzakció után?',
      'Van-e utódlási terv, megtartási és versenytilalmi megállapodás?',
    ],
    documents: ['Kulcsemberek szerződései', 'Megtartási megállapodások', 'Utódlási terv'],
  },
  'HR-02': {
    questions: [
      'Hányan dolgoznak megbízási vagy számlás konstrukcióban munkaviszony jellegű feladaton?',
      'Mekkora az átminősítés esetén várható visszamenőleges közteher?',
    ],
    documents: ['Megbízási és vállalkozói szerződések', 'Számlák', 'Munkarend-leírás'],
  },
  'HR-03': {
    questions: ['Hogyan tartják nyilván a munkaidőt és a túlórát?', 'Van-e folyamatban munkaügyi igény?'],
    documents: ['Munkaidő-nyilvántartás', 'Munkaügyi ellenőrzések'],
  },
  'HR-04': {
    questions: ['Mekkora a fluktuáció a kulcspozíciókban, és mi a bérpozíció a piachoz képest?'],
    documents: ['Fluktuációs kimutatás', 'Bérbenchmark'],
  },
  'VDD-01': {
    questions: ['Milyen tulajdonosi kölcsönök és kapcsolt követelések vannak, és hogyan rendeződnek a zárásig?'],
    documents: ['Tagi kölcsönszerződések', 'Kapcsolt egyenlegek egyeztetése'],
  },
  'VDD-02': {
    questions: ['Teljes-e az adatszoba, és mely dokumentumok hiányoznak?'],
    documents: ['Adatszoba tartalomjegyzéke', 'Hiánylista'],
  },
  'EPI-01': {
    questions: ['Mely futó projektekben van felső korlát nélküli kötbér, és mekkora a késés?'],
    documents: ['Kivitelezési szerződések', 'Projektütemtervek', 'Kötbérigények'],
  },
  'ITF-01': {
    questions: ['Készült-e licencszkennelés, és van-e copyleft komponens a terjesztett termékben?'],
    documents: ['Licencszkennelési riport', 'Nyílt forráskódú szabályzat'],
  },
  'ITF-02': {
    questions: ['Mekkora a felelősség és az SLA-kötbér az ügyfélszerződésekben?'],
    documents: ['Ügyfélszerződések', 'SLA-mellékletek', 'Kötbérigények'],
  },
  'KON-01': {
    questions: ['Mekkora a szakmai felelősségbiztosítás limitje, és volt-e kárigény?'],
    documents: ['Biztosítási kötvény', 'Kárigények listája'],
  },
  'TAN-02': {
    questions: ['Kikhez kötődnek a kulcsügyfelek, és van-e ügyfélcsábítási tilalom?'],
    documents: ['Partneri szerződések', 'Ügyfélportfólió partnerenként'],
  },
};

const GENERIC: Record<Pillar, Entry> = {
  FINANCE: { questions: ['Mekkora a tétel pénzügyi hatása, és hogyan jelenik meg a beszámolóban?'], documents: ['Kapcsolódó főkönyvi részletezők'] },
  LEGAL: {
    questions: ['Milyen szerződéses vagy jogi kötelezettség áll fenn, és milyen következménnyel jár?'],
    documents: ['Érintett szerződések és határozatok'],
  },
  OPERATIONS: { questions: ['Hogyan érinti a működést, és mi a kezelés terve?'], documents: ['Kapcsolódó belső dokumentáció'] },
  HR: { questions: ['Mely munkatársakat érinti, és milyen munkajogi kockázattal jár?'], documents: ['Érintett munka- és megbízási szerződések'] },
};

export interface BuyerQuestion {
  code: string;
  title: string;
  rag: ScoredRisk['rag'];
  pillar: Pillar;
  questions: string[];
  /** Válaszvázlat: mit tudunk mondani most, és mi a javítás állapota. */
  answerDraft: string;
  documents: string[];
}

export function buildBuyerQuestions(a: RiskAssessment, includeGreen = false): BuyerQuestion[] {
  return a.risks
    .filter((r) => includeGreen || r.rag !== 'GREEN')
    .map((r) => {
      const e = BANK[r.code] ?? GENERIC[r.pillar];
      const status = r.remediationStatus ?? 'OPEN';
      const answer = [
        `A kérdést ismerjük, a tételt az eladói átvilágítás feltárta (${r.rag === 'RED' ? 'kiemelt' : 'közepes'} súlyú).`,
        r.remediation ? `Kezelés: ${r.remediation}` : null,
        `Állapot: ${REMEDIATION_LABEL[status]}.`,
        status === 'DONE' ? 'Az elvégzett javítást igazoló iratokat az adatszobába feltöltjük.' : null,
        status === 'ACCEPTED_RISK' ? 'A vezetés a kockázatot tudatosan vállalja; a vételár-tárgyalásnál ezzel számolunk.' : null,
        status === 'OPEN' || status === 'IN_PROGRESS' ? 'A zárásig várható állapotot és a kitettséget az adatszobában bemutatjuk.' : null,
      ]
        .filter(Boolean)
        .join(' ');
      return { code: r.code, title: r.title, rag: r.rag, pillar: r.pillar, questions: e.questions, answerDraft: answer, documents: e.documents };
    });
}

export function buyerQuestionsText(companyName: string, list: BuyerQuestion[]): string {
  return [
    `Várható vevői kérdések – ${companyName}`,
    '',
    ...list.flatMap((q, i) => [
      `${i + 1}. ${q.code} ${q.title}`,
      ...q.questions.map((x) => `   – ${x}`),
      `   Válaszvázlat: ${q.answerDraft}`,
      `   Szükséges iratok: ${q.documents.join('; ')}`,
      '',
    ]),
  ].join('\n');
}
