import type { Pillar } from '@/lib/risk/types';
import type { IntervieweeRole } from './types';

export const ROLE_LABEL: Record<IntervieweeRole, string> = {
  OWNER_CEO: 'Tulajdonos / ügyvezető',
  CFO: 'Pénzügyi vezető',
  HR_LEAD: 'HR-vezető',
  OPS_LEAD: 'Operációs / termelési vezető',
  SALES_LEAD: 'Értékesítési vezető',
  IT_LEAD: 'IT-vezető',
  KEY_PERSON: 'Kulcsember (HR 361)',
};

/** Mely pillérekben illetékes az interjúalany (a kockázat-kérdések szűréséhez). */
export const ROLE_PILLARS: Record<IntervieweeRole, Pillar[]> = {
  OWNER_CEO: ['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'],
  CFO: ['FINANCE', 'LEGAL'],
  HR_LEAD: ['HR'],
  OPS_LEAD: ['OPERATIONS'],
  SALES_LEAD: ['OPERATIONS', 'LEGAL'],
  IT_LEAD: ['OPERATIONS'],
  KEY_PERSON: ['HR', 'OPERATIONS'],
};

interface BankQuestion {
  pillar: Pillar;
  text: string;
  listenFor?: string;
  followUps?: string[];
}

/** Alapkérdések szerepkörönként – minden interjúban elhangzanak. */
export const BASE_QUESTIONS: Record<IntervieweeRole, BankQuestion[]> = {
  OWNER_CEO: [
    { pillar: 'OPERATIONS', text: 'Mi a cég három legfontosabb versenyelőnye, és mi fenyegeti őket a következő 2 évben?', listenFor: 'Konkrétumok vagy általánosságok? Egyezik-e a számokkal?' },
    { pillar: 'FINANCE', text: 'Milyen egyszeri vagy nem működési tételek voltak az elmúlt 3 év eredményében?', listenFor: 'Tulajdonosi költségek, egyszeri bevételek, kapcsolt ügyletek.', followUps: ['Van-e a cég nevén magáncélú eszköz vagy költség?'] },
    { pillar: 'HR', text: 'Ha holnaptól 3 hónapig nem lenne elérhető, ki vinné a céget, és mi akadna el?', listenFor: 'Kulcsember-függőség, utódlás.' },
    { pillar: 'LEGAL', text: 'Van-e folyamatban vagy várható jogvita, hatósági eljárás, adóellenőrzés?' },
    { pillar: 'OPERATIONS', text: 'Melyik vevő vagy beszállító elvesztése okozna a legnagyobb kárt?', followUps: ['Milyen szerződés köti őket, meddig?'] },
  ],
  CFO: [
    { pillar: 'FINANCE', text: 'Hogyan zajlik a havi zárás, és hány nap alatt áll elő a vezetői riport?', listenFor: '10 munkanap felett: gyenge kontrollkörnyezet.' },
    { pillar: 'FINANCE', text: 'Milyen kapcsolt feles ügyletek vannak, és van-e rájuk transzferár-dokumentáció?', followUps: ['Ki készítette, melyik évekre?'] },
    { pillar: 'FINANCE', text: 'Mekkora a 90 napon túli vevőállomány, és hogyan képeznek rá értékvesztést?' },
    { pillar: 'FINANCE', text: 'Egyeztetik-e havonta az ÁFA-analitikát a NAV online számla adataival?' },
    { pillar: 'LEGAL', text: 'Vannak-e hitelszerződéses kovenánsok, és teljesültek-e az elmúlt 2 évben?' },
  ],
  HR_LEAD: [
    { pillar: 'HR', text: 'Hány fő dolgozik munkaviszonyban, és hányan megbízással / számlásként?', listenFor: 'Színlelt szerződés kockázata.' },
    { pillar: 'HR', text: 'Hogyan vezetik a munkaidőt és a túlórát?' },
    { pillar: 'HR', text: 'Mekkora az éves fluktuáció a kulcspozíciókban, és mi a fő kilépési ok?' },
    { pillar: 'HR', text: 'Van-e versenytilalmi és titoktartási megállapodás a kulcsembereknél?' },
  ],
  OPS_LEAD: [
    { pillar: 'OPERATIONS', text: 'Melyik az a beszállító vagy gép, amelyik kiesése megállítja a termelést?', followUps: ['Van-e alternatíva, mennyi idő alatt állítható be?'] },
    { pillar: 'OPERATIONS', text: 'Milyen engedélyek kellenek a működéshez, és mikor járnak le?' },
    { pillar: 'OPERATIONS', text: 'Volt-e az elmúlt 2 évben üzemzavar, adatvesztés vagy szállítási csúszás? Mi volt a kár?' },
  ],
  SALES_LEAD: [
    { pillar: 'OPERATIONS', text: 'A top 5 vevő adja a bevétel hány százalékát, és mennyire lojálisak?' },
    { pillar: 'LEGAL', text: 'A nagy vevői szerződések felmondhatók-e tulajdonosváltás esetén?', listenFor: 'Change of Control ismerete.' },
    { pillar: 'OPERATIONS', text: 'Kinél van a személyes kapcsolat a kulcsvevőkkel?', listenFor: 'Ha egy emberhez kötött: kulcsember-kockázat.' },
  ],
  IT_LEAD: [
    { pillar: 'OPERATIONS', text: 'Milyen ügyviteli rendszert használnak, és van-e még rá gyártói támogatás?' },
    { pillar: 'OPERATIONS', text: 'Mikor volt utoljára sikeres mentés-visszaállítási teszt?' },
    { pillar: 'LEGAL', text: 'A saját fejlesztésű szoftverek forráskódja és jogai kinél vannak?', listenFor: 'IP-átruházás hiánya alvállalkozóknál.' },
  ],
  KEY_PERSON: [
    { pillar: 'HR', text: 'Mely feladatokat csak Ön tudja ellátni a cégben?', listenFor: 'Tudáskoncentráció.' },
    { pillar: 'HR', text: 'Van-e kijelölt helyettese, és mennyi idő alatt tudná átvenni a feladatait?' },
    { pillar: 'HR', text: 'Mi tartaná Önt a cégnél egy tulajdonosváltás után?', listenFor: 'Retenciós kockázat, elvárások.' },
  ],
};

/** Célzott kérdések a Red Flag katalógus tételeihez (ha a tétel azonosított). */
export const RISK_PROBES: Record<string, BankQuestion[]> = {
  'FIN-01': [{ pillar: 'FINANCE', text: 'Mely kapcsolt vállalkozásokkal és milyen értékben volt ügylet, és hogyan határozták meg az árat?', followUps: ['Kész van-e a nyilvántartás a legutóbbi lezárt évre?'] }],
  'FIN-02': [{ pillar: 'FINANCE', text: 'Tételesen milyen tulajdonosi vagy egyszeri költségek szerepelnek az eredményben?', followUps: ['Piaci áron bérlik-e az ingatlant a tulajdonostól?'] }],
  'FIN-03': [{ pillar: 'FINANCE', text: 'Ki a legnagyobb késedelmes vevő, és mi a behajtás terve?' }],
  'FIN-04': [{ pillar: 'FINANCE', text: 'Mi okozza az eltérést az ÁFA-analitika és a NAV adatai között?' }],
  'LEG-01': [{ pillar: 'LEGAL', text: 'Tud-e arról, hogy a kulcsvevői szerződés tulajdonosváltáskor felmondható? Beszéltek erről a partnerrel?', listenFor: 'Hajlandó-e a partner lemondó nyilatkozatot adni?' }],
  'LEG-02': [{ pillar: 'LEGAL', text: 'Ki fejlesztette a kulcsszoftvert vagy terméket, és írtak-e alá felhasználási/átruházási szerződést?' }],
  'LEG-03': [{ pillar: 'LEGAL', text: 'Mikor módosították utoljára a társasági szerződést, és tükrözi-e a mostani működést?' }],
  'LEG-04': [{ pillar: 'LEGAL', text: 'Ki felel az adatvédelemért, és van-e adatkezelési nyilvántartás?' }],
  'OPS-01': [{ pillar: 'OPERATIONS', text: 'Mi történne, ha a fő beszállító holnap 30%-kal emelne árat vagy nem szállítana?' }],
  'OPS-02': [{ pillar: 'OPERATIONS', text: 'Mennyibe kerülne és meddig tartana az ügyviteli rendszer cseréje?' }],
  'OPS-03': [{ pillar: 'OPERATIONS', text: 'Ha a telephely egy hétig nem elérhető, hogyan szolgálják ki a vevőket?' }],
  'OPS-04': [{ pillar: 'OPERATIONS', text: 'Ki követi az engedélyek lejáratát, és melyik jár le a következő 6 hónapban?' }],
  'HR-01': [{ pillar: 'HR', text: 'Kinél vannak a kulcsvevő-kapcsolatok és a know-how, és mi történik, ha ő távozik?', followUps: ['Van-e retenciós vagy versenytilalmi megállapodás?'] }],
  'HR-02': [{ pillar: 'HR', text: 'A számlás munkatársak kapnak-e utasítást, kötött-e a munkaidejük, céges eszközzel dolgoznak-e?', listenFor: 'Munkaviszony jellegű elemek.' }],
  'HR-03': [{ pillar: 'HR', text: 'Hogyan rögzítik és fizetik ki a túlórát?' }],
  'HR-04': [{ pillar: 'HR', text: 'Mi a bérszínvonal a piachoz képest, és milyen ösztönzők vannak?' }],
};

/** Átvilágítás-típusonkénti extra kérdéscsoportok (lásd EngagementKindProfile.extraTopic). */
export const KIND_TOPIC_QUESTIONS: Record<string, BankQuestion[]> = {
  GROWTH: [
    { pillar: 'OPERATIONS', text: 'Mi akadályozza leginkább a következő 30% növekedést: kapacitás, ember vagy finanszírozás?' },
  ],
  TRANSACTION: [
    { pillar: 'LEGAL', text: 'Van-e bármi, amit egy vevő a due diligence során biztosan kérdezni fog, és kellemetlen lenne?', listenFor: 'Önkéntes feltárás: ezt jobb előre tudni.' },
    { pillar: 'FINANCE', text: 'Milyen árazási elvárásuk van, és mire alapozzák (EBITDA-szorzó, árbevétel)?' },
    { pillar: 'HR', text: 'Tudnak-e a kulcsemberek a tervezett tranzakcióról? Mi a kommunikációs terv?' },
  ],
  FINANCING: [
    { pillar: 'FINANCE', text: 'Mekkora finanszírozást és milyen célra keresnek, és milyen biztosítékot tudnak adni?' },
    { pillar: 'FINANCE', text: 'Mikor volt utoljára likviditási szűk keresztmetszet, és hogyan kezelték?' },
  ],
  SUCCESSION: [
    { pillar: 'LEGAL', text: 'Milyen tulajdonosi struktúrát szeretnének az átadás után (család, menedzsment, külső befektető)?' },
    { pillar: 'HR', text: 'Ki a kijelölt utód, és mely döntéseket hozza már most önállóan?' },
    { pillar: 'LEGAL', text: 'Van-e végrendelet, házassági vagyonszerződés vagy szindikátusi szerződés, amely érinti a részesedést?' },
  ],
  COMPLIANCE: [
    { pillar: 'LEGAL', text: 'Ki felel a jogszabályváltozások követéséért, és volt-e az elmúlt 3 évben bírság?' },
  ],
  INTEGRATION: [
    { pillar: 'OPERATIONS', text: 'Melyik folyamatot kell az első 100 napban egységesíteni az anyacéggel?' },
    { pillar: 'HR', text: 'Kiknek a megtartása kritikus az integráció első évében?' },
  ],
};
