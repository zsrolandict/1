import type { Pillar } from '@/lib/risk/types';
import type { EngagementKind } from '@/lib/engagement/kinds';
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
  'HC-01': [{ pillar: 'OPERATIONS', text: 'Van-e írásos éves terv, és milyen rendszeres riportot kap a vezetés?' }],
  'HC-02': [{ pillar: 'FINANCE', text: 'Hány hétre előre tervezik a likviditást, és ki készíti?' }],
  'VDD-01': [{ pillar: 'FINANCE', text: 'Milyen tulajdonosi kölcsönök és kapcsolt tartozások vannak, és rendezhetők-e az eladás előtt?' }],
  'VDD-02': [{ pillar: 'LEGAL', text: 'Hol vannak a hatályos szerződések, engedélyek és határozatok, és mi hiányzik közülük?' }],
  'BUY-01': [{ pillar: 'LEGAL', text: 'Milyen szavatosságot és kártalanítást hajlandó vállalni az eladó a feltárt tételekre?' }],
  'BUY-02': [{ pillar: 'FINANCE', text: 'Van-e folyamatban per, kezesség, bankgarancia vagy adóellenőrzés, amely nem látszik a mérlegben?' }],
  'FIK-01': [{ pillar: 'FINANCE', text: 'Mekkora a tartalék a kovenánsok határértékéig, és mi történik egy gyengébb negyedévben?' }],
  'FIK-02': [{ pillar: 'FINANCE', text: 'Van-e havi bontású cash-flow terv a következő 12 hónapra, és mennyire pontos volt tavaly?' }],
  'SUC-01': [{ pillar: 'LEGAL', text: 'Hogyan döntenek a tulajdonosok vita esetén, és mi történik, ha valamelyikük ki akar lépni?' }],
  'SUC-02': [{ pillar: 'FINANCE', text: 'Mely családi vagy magáncélú tételek futnak a cégen, és hogyan választanák le őket?' }],
  'CMP-01': [{ pillar: 'LEGAL', text: 'Mely kötelező szabályzatok vannak meg, és mikor frissültek utoljára?' }],
  'CMP-02': [{ pillar: 'FINANCE', text: 'Volt-e adóellenőrzés az elmúlt 5 évben, és mely tételek voltak vitatottak?' }],
  'PMI-01': [{ pillar: 'HR', text: 'Kik a legfontosabb 5–10 ember, és kaptak-e már megtartási ajánlatot?' }],
  'PMI-02': [{ pillar: 'OPERATIONS', text: 'Mely rendszerek és folyamatok futnak párhuzamosan, és mi az összevonás terve?' }],
  // Mintaesetek szektortételei
  'EPI-01': [{ pillar: 'LEGAL', text: 'Mely futó szerződésekben van kötbér, van-e felső korlátja, és melyik projekt csúszik most?', listenFor: 'Ismeri-e a vezetés a plafon nélküli kötbéreket.' }],
  'EPI-02': [{ pillar: 'OPERATIONS', text: 'A legnagyobb megrendelő az árbevétel hány százalékát adja, és mi lenne, ha a következő ütem elmaradna?' }],
  'EPI-03': [{ pillar: 'FINANCE', text: 'Hogyan számolják el a folyamatban lévő projektek bevételét és költségét, és látják-e projektenként a fedezetet?' }],
  'EPI-04': [{ pillar: 'HR', text: 'Ki felel a munkavédelemért, és hogyan oktatják az alvállalkozói brigádokat?' }],
  'KON-01': [{ pillar: 'LEGAL', text: 'Mekkora összegre szól a szakmai felelősségbiztosítás, és volt-e már ügyfélkár vagy kárigény?' }],
  'KON-02': [{ pillar: 'LEGAL', text: 'Hogyan végzik az új ügyfelek átvilágítását, és mikor frissült a pénzmosás elleni belső szabályzat?' }],
  'KON-03': [{ pillar: 'FINANCE', text: 'Mikor emeltek utoljára díjat, és van-e a szerződésekben indexálási záradék?' }],
  'KON-04': [{ pillar: 'LEGAL', text: 'Milyen arányban és ütemezésben kerülnek át az üzletrészek, és mi történik, ha az utódok nem értenek egyet?' }],
  'ITF-01': [{ pillar: 'LEGAL', text: 'Milyen nyílt forráskódú licenceket használnak a termékben, és ki ellenőrzi ezt?' }],
  'ITF-02': [{ pillar: 'LEGAL', text: 'Mekkora a felelősség és az SLA-kötbér felső határa a nagy ügyfélszerződésekben?' }],
  'ITF-03': [{ pillar: 'OPERATIONS', text: 'Milyen információbiztonsági követelményeket támasztanak az ügyfelek, és hogyan igazolják ezek teljesítését?' }],
  'ITF-04': [{ pillar: 'OPERATIONS', text: 'Van-e architektúra-dokumentáció, és teljesül-e az ügyfeleknek vállalt forráskód-letét?' }],
};

/** Típus-specifikus kérdés: kinek szól (szerepkörök). */
export interface KindQuestion extends BankQuestion {
  roles: IntervieweeRole[];
}

/**
 * Átvilágítás-típusonként célzott kérdések, címzetthez kötve.
 * Ugyanazt a témát más-más szemszögből kérdezzük (pl. utódlásnál az
 * alapítót és a kijelölt utódot külön).
 */
export const KIND_QUESTIONS: Record<EngagementKind, KindQuestion[]> = {
  HEALTH_CHECK: [
    { roles: ['OWNER_CEO'], pillar: 'OPERATIONS', text: 'Mi akadályozza leginkább a következő 30% növekedést: kapacitás, ember vagy finanszírozás?' },
    { roles: ['OWNER_CEO'], pillar: 'FINANCE', text: 'Milyen számokat néz meg havonta, és mi alapján dönt a nagyobb beruházásokról?', listenFor: 'Van-e vezetői riport és terv, vagy megérzés alapján döntenek.' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Hány hétre előre látja a cég likviditását, és volt-e az elmúlt évben szűk keresztmetszet?' },
    { roles: ['OPS_LEAD'], pillar: 'OPERATIONS', text: 'Melyik folyamat okozza a legtöbb hibát, túlórát vagy reklamációt?' },
    { roles: ['HR_LEAD'], pillar: 'HR', text: 'Mely pozíciókat a legnehezebb betölteni, és mennyi ideig tart egy felvétel?' },
  ],
  VENDOR_DD: [
    { roles: ['OWNER_CEO'], pillar: 'LEGAL', text: 'Van-e bármi, amit egy vevő az átvilágítás során biztosan kérdezni fog, és kellemetlen lenne?', listenFor: 'Önkéntes feltárás: ezt jobb előre tudni, mint a vevőtől megtudni.' },
    { roles: ['OWNER_CEO'], pillar: 'FINANCE', text: 'Milyen vételár-elvárása van, és mire alapozza (EBITDA-szorzó, árbevétel, ajánlat)?', followUps: ['Elfogadna-e teljesítményfüggő vételárrészt (earn-out)?', 'Maradna-e átmeneti ideig a cégben?'] },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Mely eredménytételek egyszeriek vagy tulajdonosi jellegűek, amelyeket a vevő ki fog szűrni?', listenFor: 'Normalizált EBITDA alapja.' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Mennyi a szokásos forgótőke-igény, és vannak-e mérlegen kívüli kötelezettségek (garancia, kezesség, per)?' },
    { roles: ['SALES_LEAD'], pillar: 'LEGAL', text: 'Melyik nagy vevő tudna kilépni tulajdonosváltáskor, és hogyan reagálna egy új tulajdonosra?' },
    { roles: ['HR_LEAD', 'KEY_PERSON'], pillar: 'HR', text: 'Tudnak-e a kulcsemberek a tervezett eladásról, és mi tartaná meg őket egy új tulajdonosnál?' },
  ],
  BUY_SIDE_DD: [
    { roles: ['OWNER_CEO'], pillar: 'LEGAL', text: 'Van-e folyamatban vagy várható per, hatósági eljárás, adóellenőrzés, amelyről a vevőnek tudnia kell?', listenFor: 'Szavatossági nyilatkozatok alapja.' },
    { roles: ['OWNER_CEO'], pillar: 'HR', text: 'Mely döntéseket csak Ön hozza meg ma, és ki venné át ezeket a zárás után?' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Milyen tulajdonosi, kapcsolt vagy egyszeri tételek vannak az utolsó 3 év eredményében?' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Milyen garanciák, kezességek, kötbérek és függő kötelezettségek terhelik a céget?' },
    { roles: ['SALES_LEAD'], pillar: 'OPERATIONS', text: 'Mennyire stabil a top 5 vevő, és mikor járnak le a szerződéseik?' },
    { roles: ['KEY_PERSON'], pillar: 'HR', text: 'Mit várna egy új tulajdonostól, és mi lenne az a pont, ahol távozna?', listenFor: 'Megtartási feltételek, kockázat.' },
  ],
  FINANCING_READINESS: [
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Mekkora finanszírozást, milyen célra és futamidőre keresnek, és milyen biztosítékot tudnak adni?' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Teljesülnek-e a meglévő hitelek kovenánsai, és van-e 12 hónapos cash-flow terv?', listenFor: 'A bank első kérdései.' },
    { roles: ['CFO', 'SALES_LEAD'], pillar: 'FINANCE', text: 'Melyik vevő fizet rendszeresen késve, és mi a behajtás menete?' },
    { roles: ['OWNER_CEO'], pillar: 'FINANCE', text: 'Vállalna-e tulajdonosi kezességet vagy tőkeemelést, ha a bank kéri?' },
    { roles: ['OPS_LEAD'], pillar: 'OPERATIONS', text: 'Milyen beruházás nélkül nem teljesíthető a következő 2 év terve?' },
  ],
  SUCCESSION: [
    { roles: ['OWNER_CEO'], pillar: 'HR', text: 'Ki a kijelölt utód, és mely döntéseket hozza már most önállóan?' },
    { roles: ['OWNER_CEO'], pillar: 'LEGAL', text: 'Milyen tulajdonosi struktúrát szeretne az átadás után (család, menedzsment, külső befektető), és milyen ütemben?' },
    { roles: ['OWNER_CEO'], pillar: 'LEGAL', text: 'Van-e végrendelet, házassági vagyonszerződés vagy tulajdonosi megállapodás, amely érinti a részesedést?' },
    { roles: ['OWNER_CEO'], pillar: 'FINANCE', text: 'Milyen családi vagy magáncélú tételek futnak a cégen keresztül (ingatlan, autó, kölcsön)?' },
    { roles: ['KEY_PERSON'], pillar: 'HR', text: 'Ön szerint mikor és hogyan veszi át a vezetést, és mit tartana meg, mit változtatna?', listenFor: 'Egyezik-e az alapító elképzelésével.' },
    { roles: ['KEY_PERSON'], pillar: 'HR', text: 'Tudják-e a kulcsügyfelek és a munkatársak, hogy Ön lesz az utód? Kivel nincs még közvetlen kapcsolata?' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Van-e friss cégértékelés, és hogyan fizetnék ki a nem aktív családtagokat?' },
    { roles: ['HR_LEAD'], pillar: 'HR', text: 'Kik azok, akik az alapító távozásával vagy a vezetőváltással elbizonytalanodhatnak?' },
  ],
  COMPLIANCE_AUDIT: [
    { roles: ['OWNER_CEO', 'CFO'], pillar: 'LEGAL', text: 'Ki felel a jogszabályváltozások követéséért, és volt-e az elmúlt 3 évben hatósági ellenőrzés vagy bírság?' },
    { roles: ['CFO'], pillar: 'FINANCE', text: 'Mely adózási tételek voltak az elmúlt években vitatottak vagy bizonytalanok (kapcsolt ügyletek, visszaigénylés)?' },
    { roles: ['HR_LEAD'], pillar: 'HR', text: 'Megvannak-e a kötelező szabályzatok (munkaidő, munkavédelem, visszaélés-bejelentés), és mikor frissültek?' },
    { roles: ['IT_LEAD'], pillar: 'LEGAL', text: 'Hol tárolják a személyes adatokat, ki fér hozzájuk, és volt-e adatvédelmi incidens?' },
    { roles: ['OPS_LEAD'], pillar: 'OPERATIONS', text: 'Mely engedélyek járnak le a következő 12 hónapban, és ki követi ezeket?' },
  ],
  POST_MERGER: [
    { roles: ['OWNER_CEO'], pillar: 'OPERATIONS', text: 'Melyik folyamatot kell az első 100 napban egységesíteni az anyacéggel, és mi maradhat a régi?' },
    { roles: ['HR_LEAD'], pillar: 'HR', text: 'Kiknek a megtartása kritikus az integráció első évében, és mi a megtartási terv?' },
    { roles: ['KEY_PERSON'], pillar: 'HR', text: 'Mi aggasztja leginkább az új tulajdonossal kapcsolatban, és mi segítené, hogy maradjon?' },
    { roles: ['OPS_LEAD'], pillar: 'OPERATIONS', text: 'Hol dolgoznak most párhuzamosan két rendszerben vagy két jóváhagyási renddel?' },
    { roles: ['IT_LEAD'], pillar: 'OPERATIONS', text: 'Milyen rendszereket és hozzáférési jogokat kell összevonni vagy megszüntetni, és milyen sorrendben?' },
  ],
};
