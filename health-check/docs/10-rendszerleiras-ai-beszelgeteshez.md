# ICT Health Check – teljes rendszerleírás (AI-beszélgetéshez)

> **Hogyan használd:** másold be ezt a teljes dokumentumot egy AI-asszisztens (pl. Gemini) beszélgetésének elejére, és írd elé:
>
> *„Az alábbi egy belső tanácsadói szoftver rendszerleírása. Ennek alapján válaszolj a kérdéseimre, és ha valamit a leírás nem tartalmaz, mondd meg, ne találd ki. Magyarul válaszolj.”*
>
> A leírás önálló: nem kell hozzá a forráskód. Állapot: **béta**, 2026. szeptember. Forráskód: `health-check/` mappa (GitHub: zsrolandict/1, `claude/ict-diagnostic-tool-design-cf6xvg` ág).

---

## 1. Mi ez és kinek szól?

Az **ICT Health Check** az ICT Európa tanácsadó cégcsoport belső eszköze magyar KKV-k (jellemzően 0,5–5 Mrd Ft árbevétel) **gyors átvilágítására**. Egy átvilágítás négy pilléren vizsgálja a céget: **Pénzügy/Adó, Jog, Operáció, HR**. A végeredmény egy **Red Flag mátrix** (a feltárt kockázatok értékelt listája), forintosított kitettséggel, 90 napos akciótervvel, ajánlattal (melyik ICT-divízió mit javítana), valamint PDF- és Excel-riport.

**Üzleti modell:** fix díjas átvilágítás (alapértelmezés 1,2 M Ft, 18–21 órás keret). A feltárt hibák javítását az ICT divíziói (Jog, Adó, Könyvelés, HR, Tanácsadás) ajánlják; az átvilágítás díja a javítási megbízásba beszámítható („kredit”).

**Felhasználók:**
- **Tanácsadók** (partner, menedzser, szakértő) – a fő felhasználók; ők gyűjtik az adatot, interjúznak, értékelnek.
- **Ügyfél** – a tervek szerint saját portálon tölt fel iratot és tölti ki a kérdőívet (részben kész).
- **Vezetés** – az óraszám-, fedezet- és tudástár-adatokat látja.

**Alapelv: az AI csak javasol, a döntést mindig a szakértő hozza.** Semmi nem kerül automatikusan a mátrixba vagy a riportba.

## 2. Átvilágítás-típusok

A motor és a katalógus ugyanaz, a típus a hangsúlyokat (pillérsúlyok), az órakeretet, a kiemelt tételeket és a riport nézőpontját állítja.

| Típus | Címzett | Súlyok (Pénzügy / Jog / Operáció / HR) | Órakeret |
|---|---|---|---|
| Vállalati Health Check | tulajdonos / ügyvezetés | 30 / 25 / 25 / 20% | 18 |
| Vendor Due Diligence (eladói) | eladó és potenciális vevők | 35 / 30 / 15 / 20% | 21 |
| Buy-side Due Diligence (vevői) | vevő / befektető | 35 / 30 / 20 / 15% | 21 |
| Finanszírozási felkészültség | bank / tőkebefektető | 50 / 20 / 20 / 10% | 18 |
| Generációváltás / utódlás | alapító család | 20 / 30 / 15 / 35% | 20 |
| Megfelelőségi audit | ügyvezetés / FB | 30 / 35 / 15 / 20% | 19 |
| Akvizíció utáni integráció | új tulajdonos | 25 / 20 / 30 / 25% | 20 |

Az órakeretből 2 óra projektvezetés, a többi a súlyok szerint oszlik a pillérekre. **Típusfüggő korrekció:** ugyanaz a hiba más súlyú a céltól függően (pl. eladásnál a Change of Control záradék súlyosabb); a program ilyenkor a valószínűséget vagy a hatást 1-gyel módosítja (kezdő javaslat, szakértői jóváhagyásra vár).

## 3. Egy átvilágítás menete a programban

A bal oldali (összecsukható) sávban az oldalak: **Adatgyűjtés → Interjúk → Red Flag mátrix → Projekt**, alatta a **Kalauz**, amely a következő lépést mutatja („Odaviszlek” gombbal). A felső sávban a **projektválasztó** és a **mentésjelző** van. Minden oldal tetején a projekt négy szakasza látszik (Adatgyűjtés → Interjúk → Értékelés → Lezárás), kattintható.

1. **Új projekt** (cégnév + típus) – üres katalógussal, mintaadat nélkül indul. Mellette 4 kitalált **bemutató cég** (gyártó, építőipari, könyvelő, IT-fejlesztő) próbálgatáshoz.
2. **Adatgyűjtés** (6 fül):
   - **0. Tényállás és iratbekérés:** ágazat, létszám, jellemzők (pl. generációváltás, több tulajdonos, közbeszerzés), szabad leírás. Ebből áll össze az **iratbekérési lista** (alap iratkör minden projektben + a típus/ágazat/jellemzők szerinti extra iratok, indokkal; állapot: bekérve / beérkezett / hiányzik / nem releváns). Itt olvasható be a **cégkivonat** is.
   - **1. Pénzügyi alapadatok:** a beszámoló kulcsszámai 3 évre, mutatók (EBITDA, likviditás, eladósodottság, tőkehelyzet, fizetési idők), és beírható tények (könyvvizsgálói vélemény, NAV-tartozás, függő kötelezettségek, perek, hitelek, támogatások, tagi kölcsön, létszám, biztosítás). Minden értékhez forrás tartozik. Az iratból (beszámoló, kiegészítő melléklet, könyvvizsgálói jelentés…) az AI kiolvassa a számokat idézettel, a tanácsadó hagyja jóvá. Szabályok javasolnak belőle tételeket (pl. nem tiszta vélemény, tőkevesztés, árbevétel-esés).
   - **2. Kérdőív:** kb. 30 alapkérdés + ágazati kérdések, feltételes megjelenítéssel; a jelző válaszokból szabályalapú kockázati javaslat lesz.
   - **3. Adattáblák:** vevő- és szállítói folyószámla, bérlista, szerződéslista (CSV/XLSX, a böngészőben dolgozva fel); mutatók pl. vevőkoncentráció, 90/180 napon túli tételek; küszöb fölött javaslat.
   - **4. Dokumentumok:** iratok (PDF, DOCX, TXT) AI-elemzése a személyes adatok maszkolása után, idézettel és oldalszámmal. Feltöltéskor **irattípus** választható (23 típus: beszámoló, melléklet, könyvvizsgálói jelentés, vezetői levél, NAV-folyószámla, adóellenőrzés, hitel- és támogatási szerződés, létesítő okirat, vevői/szállítói szerződés, munkaszerződés, bérlet, biztosítás, adatvédelem, peres irat…); típusonként célzott „mit keresünk” lista, és a bekérési listán az irat „Beérkezett” lesz.
   - **5. Összkép:** a források keresztellenőrzése (ellentmondások, pl. a kérdőív szerint nincs vevőkoncentráció, a tábla szerint van), és AI-szintézis, amely több forrás összeolvasásából talál új kockázatot.
3. **Interjúk:** a típusból és a bejelölt kockázatokból **interjúterv** (kivel, miért, mennyi ideig) és célzott **kérdéslista**; hangfelvétel/videó → **leirat** (több beszélő is), vagy beírt jegyzet → **AI-elemzés**: állítások, javasolt kockázatok, **ellentmondások** az ismert tényekkel, utókérdések. Ha az átvilágítás típusa közben változik, a program jelzi, hogy az elemzést újra kell futtatni.
4. **Red Flag mátrix:** a katalógus tételei (bepipálás = fennáll), 1–5 valószínűség és hatás, forintosítás, pillér-egészség, 5×5 hőtérkép, akcióterv, ajánlat. Tapadó belső menü a szakaszokhoz, részletes vagy tömör táblázatnézet. Minden tételnél **Miért?** panel: a források idővonala (hely, idézet, indoklás, hatás, ki fogadta el), ugrás a forrásra, a pontszám levezetése, a módosítások naplója (csökkentésnél kötelező indoklás). Kiegészítők: **Mi lenne, ha…** (javítások hatásának szimulációja), **Vevői kérdéslista** (eladói átvilágításnál a várható vevői kérdések, válaszvázlat, iratok), **Utókövetés** (javítási állapot, pillanatkép, összevetés 3–6 hónap múlva). Export: **PDF-riport** (benne „A vizsgálat terjedelme” fejezet és „Bizonyítéktár” melléklet), **Excel** (Bizonyítéktár, Változásnapló, Vizsgálati terjedelem munkalap).
5. **Projekt:** **Időkeret** (órarögzítés pillérenként, 80%/100% riasztás, belső költség, fedezet a díjhoz képest) és **Tudástár** (a lezárt projektek anonim összesítője: mi gyakori egy ágazatban, mi nincs itt jelölve, hol tér el a katalógus a tapasztalattól).

**Modulkapcsolók:** a Kalauz „Modulok” fülén 12 modul kikapcsolható (pl. cégkivonat, interjúk, tudástár); a kikapcsolt modul eltűnik a menüből és a lépések közül, az adatai megmaradnak. A Red Flag mátrix mindig bekapcsolt.

## 4. Kézi (szabályalapú) és AI-vezérelt részek

| Rész | Típus | Megjegyzés |
|---|---|---|
| Tényállás, iratlista | kézi (+ AI-javaslat a leírásból) | az iratlista szabályalapú |
| Ágazati katalógusok (6 ágazat) | kézi | saját tételek és kérdések |
| Cégkivonat | AI-kiolvasás + szabályok | pl. folyamatban lévő eljárás → piros javaslat; gyakori vezetőváltás; ellentmondás a kérdőívvel |
| Kérdőív, adattáblák | kézi, szabályalapú | küszöbök, feltételek |
| Dokumentumelemzés | AI | maszkolás után, idézettel; irattípus szerint célzottan |
| Pénzügyi alapadatok | kézi + AI-kiolvasás jóváhagyással + szabályok | a szám benne kell legyen az idézetben; ezer Ft → Ft átváltás a programban |
| Bizonyíték-lánc, változásnapló | kézi (automatikus rögzítés) | minden elfogadásnál és módosításnál |
| Keresztellenőrzés | kézi (szabály) | források összevetése |
| Összkép-szintézis | AI | csak új, több forrásból adódó kockázat |
| Interjúterv, kérdések | kézi (+ AI-bővítés) | |
| Leirat | AI-szolgáltató (Gemini vagy Azure Speech) | a hangot nem tároljuk |
| Interjúelemzés | AI | ellentmondás-keresés az ismert tényekkel |
| Kockázati motor, forintosítás, akcióterv, riport | kézi (determinisztikus) | ugyanazokból a számokból a képernyő, a PDF és az Excel |
| Mi lenne ha, vevői kérdések, utókövetés, időkeret, tudástár | kézi | |

## 5. A kockázati motor szabályai (pontosan)

- **Pontszám** = valószínűség (1–5) × hatás (1–5). **Piros**, ha ≥ 15; **sárga**, ha ≥ 8; alatta **zöld**.
- **Valószínűség → esély:** 1 = 5%, 2 = 20%, 3 = 40%, 4 = 65%, 5 = 90%.
- **Kitettség (bruttó):** a tétel forintosított kára, képletből vagy kézzel (lásd 6. pont).
- **Várható veszteség** = kitettség × esély.
- **Lényegességi küszöb** (alapból 50 M Ft): ha egy tétel várható vesztesége eléri, a tétel pontszámtól függetlenül **piros**.
- **Pillér-egészség (0–100):** minden azonosított tétel a pontszámával arányosan „lecsíp” a maradékból: `100 × Π(1 − pontszám/25 × 0,6)`. Egy kritikus tétel erősebben hat, mint sok apró.
- **Pillér színe:** piros, ha van piros tétele vagy 40 alatt van; sárga, ha van sárga tétele vagy 70 alatt van; egyébként zöld.
- **Health Score:** a pillér-egészségek súlyozott átlaga (a típus súlyaival). **Összesített státusz** = a legrosszabb pillér színe.
- **Akcióterv:** gyors javítás (nem zöld és ≤ 5 munkanap) → 0–30 nap; piros → 31–60 nap; sárga → 61–90 nap; zöld → később.
- **Prioritás a listában:** 50% pontszám + 50% várható veszteség (a legnagyobbhoz mérve) + gyors javításnál bónusz.
- **Ajánlat:** a nem zöld tételek javítási díja divíziónként; beszámítható kredit = min(átvilágítási díj, teljes díj).
- **Javítási díj:** tételenként javítási terv – munkalépések (leírással), lépésenként üzletág, szint és óra × az üzletág óradíja; a terjedelemtől (pl. érintett szerződések száma) függő órák; sáv (alsó–felső) a bizonytalanság okával; az ügyfél ráfordítása és a külső költségek külön. Tételenként pontosítható, vagy kézi díj indoklással. Az óradíjak és a sablonok kezdő javaslatok.
- **Üres értékelés:** amíg egyetlen tétel sincs bepipálva, a program nem mutat „Zöld / 100” eredményt, hanem „Még nincs értékelés” teendőt; export előtt rákérdez.

## 5b. Nyomon követhetőség

- **Bizonyíték-lánc:** minden tételhez forráslista; minden forrás külön bejegyzés (pontos hely, szó szerinti idézet, indoklás, hatás a pontszámra, ki fogadta el, mikor, AI-nál bizonyosság). A második forrás nem írja felül az elsőt.
- **Levezetés:** megadott érték → típus-korrekció → pontszám → kitettség → várható veszteség → lényegességi küszöb → besorolás; Health Score pillérenként és súlyozva.
- **Változásnapló:** kézi pipálás és módosítás naplózva; a súlyosság csökkentéséhez indoklás kell, hiánya látszik a sorban és a riport belső jelzésében.
- **Forrásnézet:** egy iratnál vagy táblánál látszik, mely tételek születtek belőle.
- **Riport:** „A vizsgálat terjedelme” (mit láttunk, mit nem) és „Bizonyítéktár” melléklet.
- **Levezetés-munkafüzet:** letölthető Excel élő képletekkel, ugyanazt számolja, mint a program (teszttel igazolva); a sárga bemeneti cellák átírhatók, látszik, mi mit befolyásol.
- **Lefedettség és minősítési kapu:** pillérenként a megválaszolt kérdések és a beérkezett kötelező iratok arányának átlaga (szakértői felülbírálás indoklással, naplózva). 50% alatt, megállapítás nélkül a pillér „Nem vizsgált”: kimarad a Health Score nevezőjéből (nem kap 100-at). 80% összesített lefedettség alatt „Részleges / nem minősített felmérés”: nem adható Zöld; egy vizsgált pillér sem: „Nem értékelhető”.
- **Feltevések:** minden módszertani állandó (esély-tábla, sávok, Health-szorzó, prioritás, küszöbök, katalógus-alapértékek) egy nyilvántartásban, értékkel, forrással, állapottal (jóváhagyva / kezdő javaslat); a Miért? panelen és a munkafüzet „Feltevések” lapján látszik. Egyik sincs még kalibrálva lezárt projektek kimenetén.
- **Vélemény és kritikus felülvizsgálat:** a tanácsadó véleményt fűzhet egy eredményhez; az AI a forrásokkal és a levezetéssel veti össze, nem ért egyet automatikusan. A program elveti a nem létező forrásra vagy nem található idézetre hivatkozást, a forrás nélküli enyhítést, és a forrás nélküli „egyetért”-et „bizonyíték kell”-re írja át. A javaslat csak kézi átvétellel lép életbe, a változásnaplóba indoklással kerül.

## 6. Forintosítás

A tételek kitettségét képletek becsülik a cégadatokból (éves árbevétel, fedezeti hányad, tényleges és iparági vevői fizetési idő – DSO); tételenként szakértői felülírással:
- **árbevétel-arány** (pl. egy vevő elvesztése = árbevétel × érintett arány, opcionálisan × fedezet);
- **darab × tételösszeg** (pl. hiányzó szerződések × becsült kár);
- **DSO-különbség** (árbevétel / 365 × többletnapok = lekötött pénz);
- **kézi összeg**.

Ha az árbevétel nincs megadva (új projekt), a képletek 0 Ft-ot adnak, és ezt a felület, a PDF és az Excel is jelzi. A képletek egyes paraméterei „TERVEZET” jelölésűek (szakértői jóváhagyásra várnak), ezt a riport feltünteti.

## 7. Kockázati katalógus

**Alapkatalógus (17 tétel):**
- Pénzügy/Adó: FIN-01 Transzferár-dokumentáció hiánya · FIN-02 Nem normalizált, egyszeri tételekkel torzított EBITDA · FIN-03 Lejárt vevőállomány koncentrációja · FIN-04 Főkönyv–bevallás eltérés (ÁFA analitika)
- Jog: LEG-01 Change of Control záradék kulcsszerződésben · LEG-02 Hiányzó IP-átruházás · LEG-03 Elavult létesítő okirat / SZMSZ · LEG-04 GDPR megfelelés hiányosságai
- Operáció: OPS-01 Beszállítói koncentráció (> 40%) · OPS-02 Technológiai adósság (nem támogatott ERP) · OPS-03 Hiányzó üzletmenet-folytonossági terv · OPS-04 Engedélyek / hatósági megfelelés lejárata · OPS-05 Vevőkoncentráció (> 25%)
- HR: HR-01 Kulcsember-függőség · HR-02 Színlelt vállalkozói jogviszonyok · HR-03 Hiányos munkaidő-nyilvántartás · HR-04 Nem versenyképes javadalmazás / magas fluktuáció

**Pénzügyi alapadatokból (PA-01…PA-20):** nem tiszta könyvvizsgálói vélemény, folytatási bizonytalanság, tőkevesztés, árbevétel-esés, romló EBITDA, eladósodottság, gyenge likviditás, adótartozás, adóellenőrzési megállapítás, függő kötelezettség, perek, támogatás fenntartási kötelezettséggel, hitelkovenáns / tulajdonosváltási záradék, közeli hitellejárat, tagi kölcsön, késedelmes letétbe helyezés, osztalék gyenge tőke mellett, vezetői levél hiányosságai, felelősségbiztosítás hiánya, beszámoló ↔ adattábla eltérés. Csak elfogadott javaslatként kerülnek a mátrixba.

**Kiegészítők:** típusonkénti tételek (pl. VDD-01 rendezetlen tulajdonosi kölcsönök, FIK-01 kovenánssértés kockázata), **ágazati** tételek 6 ágazatra (Gyártás, Építőipar, Kereskedelem, Tanácsadás, Informatika, Könyvelés – pl. plafon nélküli kötbér, elöregedett géppark), és **egyedi** (katalóguson kívüli) tételek az AI-javaslatokból vagy kézzel. Minden tételhez szakmai indoklás, javasolt intézkedés, munkanap, felelős divízió és javítási terv (lépések, órák, díj sávval) tartozik.

## 8. Az AI használata

- **Szolgáltató-független:** Claude (Anthropic) vagy Google Gemini, egy beállítással (`AI_PROVIDER`); leirathoz Gemini vagy Azure Speech. A kattintható előnézetben a claude.ai beépített AI-ja fut.
- **Minden AI-hívás strukturált** (előre megadott JSON-séma).
- **Védvonalak:**
  1. a bemenet (dokumentum, leirat, kivonat) „adat, nem utasítás” – a prompt kimondja;
  2. **szó szerinti idézet** kötelező, és a program ellenőrzi, hogy szerepel-e a forrásban – ami nem, azt eldobja, és a kiszűrt elemeket okkal együtt listázza (interjú, dokumentum, összkép, tényállás, cégkivonat);
  3. oldalszámot, forrást a rendszer ad, nem a modell;
  4. személyes adatok maszkolása dokumentumelemzés előtt;
  5. az AI csak javasol, a szakértő fogad el.
- **Béta-döntés:** a bétában ingyenes Gemini-kulcs is használható – ez **szándékos**. Éles üzemben valódi ügyféladathoz fizetős, adatfeldolgozói szerződéses (DPA), EU-s szolgáltató kell; a program éles módban ezt egy kapcsolóhoz köti (`AI_DPA_CONFIRMED=1`).

## 9. Adatok, tárolás, projektek

- **Béta: az adatok a böngészőben (localStorage) tárolódnak**, projektenként külön. Minden módosítás azonnal mentődik; a jobb felső „Helyben mentve – X perce” jelzi. Ha a mentés nem sikerül (betelt a böngésző tárhelye), piros figyelmeztetés jelenik meg.
- **Mentés fájlba / visszatöltés** (JSON): a projekt minden adata; visszatöltéskor ellenőrzött szerkezet, mindig új projektként (meglévőt nem ír felül). Ha régóta nincs fájlba mentés, a program figyelmeztet.
- **Több projekt egyszerre:** az aktív projekt böngészőlaponként külön; a **Projektjeim** áttekintő mutatja minden projekt haladását, következő lépését, és ott folytatja, ahol abbahagytad. Ha ugyanazt a projektet két lapon módosítják, a program jelez.
- **Tudástár:** a lezárt projektekből csak anonim adat (típus, ágazat, árbevétel-sáv, katalógustételek besorolása) – cégnév, összeg, bizonyíték nem.
- **Adatbázis (szerveroldal kész, a felület még nincs átállítva):** Supabase (PostgreSQL, EU régió), 14 migráció; atomikus szerveres mentés (minden vagy semmi, verzióütközés-védelemmel), hamisíthatatlan (csak bővíthető, szerver által bélyegzett) napló, sorszintű jogosultsággal (RLS) – pl. a HR-szakértő csak HR-dokumentumot és a bizalmas interjút látja, az ügyfél csak a saját feltöltéseit –, audit naplóval.

## 10. Technológia és biztonság

- **Alkalmazás:** Next.js 16 (React 19, TypeScript), Tailwind; magyar felület, asztali használatra (a mobil nézet szándékosan nincs optimalizálva).
- **Riport:** PDF a böngészőben (react-pdf), Excel saját íróval.
- **Bejelentkezés:** Supabase (céges Microsoft-fiók vagy meghívásos e-mail link); csak meghívott felhasználó léphet be (Auth-hook + adatbázis-trigger + domain-szűrés); a munkamenet-süti HttpOnly/Secure/SameSite; beállítás nélkül az AI-funkciók zárva. Élesítési lépések: docs/12.
- **Szerveroldali védelmek:** minden AI-végpont bejelentkezett belső felhasználót kér; felhasználónkénti, adatbázisban tárolt (több szerverpéldányon is közös, IP-hamisítással nem kerülhető meg) hívásszám-korlát (40 AI-hívás, 10 leirat óránként); éles módban az AI-felülvizsgálat a forrásokat az adatbázisból veszi, nem a kérésből; bemenet-ellenőrzés és méretkorlátok; tömörítési bomba elleni védelem; belső hibarészlet nem jut ki; biztonsági fejlécek (CSP, keretezés tiltása, HSTS); belépés után csak saját oldalra irányít vissza.
- **Minőség:** automatikus ellenőrzés (CI) minden változásnál – típusok, lint, formázás, 252 unit teszt, build, adatbázis-migrációk és jogosultsági füsttesztek, két böngészős füstteszt (előnézet és éles build).
- **Monitoring:** strukturált, tartalom nélküli napló minden AI-hívásról és hibáról (riasztás állítható rá).

## 11. Állapot és korlátok (béta)

**Kész és kipróbálható:** minden fenti modul, a 4 bemutató céggel és saját projekttel; kattintható előnézet szerver nélkül.

**Még nincs kész / korlát:**
- szerveres mentés és közös munka egy projekten (a tárolás a böngészőben van, böngészőnként kb. 5 MB);
- az AI-hívások szinkronok (max. 5 perc/hívás); nagy hangfájl a saját gépes változatban;
- ügyfélportál (az ügyfél saját belépése);
- szkennelt PDF-hez OCR;
- a szakmai paraméterek (óraköltségek, típusfüggő korrekciók, képlet-paraméterek) jóváhagyása;
- mobil nézet.

**Terv (rendszerterv):** 1) szerveres mentés Supabase-szel, 2) AI-feladatsor háttérfeldolgozással és közös hívásszám-korláttal, 3) valós idejű frissítés több felhasználónál, 4) ügyfélportál és monitoring.

## 12. Nyitott kérdések (döntésre várnak)

1. Az ágazati katalógusok (6 ágazat) szakmai átnézése és jóváhagyása.
2. A belső óraköltségek (partner / szenior / junior) véglegesítése – most tervezet: 25 000 / 15 000 / 9 000 Ft/óra.
3. A típusfüggő korrekciók, a képlet-paraméterek és a pénzügyi szabályok küszöbeinek jóváhagyása (pl. árbevétel-esés 20%, nettó adósság/EBITDA 3,5×, likviditási ráta 1).
4. Egy ár mind a 7 típusra, vagy típusonként külön csomag? Meddig érvényes a kredit?
5. Dokumentumok megőrzési ideje lezárás után; ki üzemelteti a rendszert; melyik AI-szolgáltatóval köt DPA-t a cég.
6. Pilot: melyik 2–3 projekt, kik vesznek részt.

## 13. Fogalomtár

- **Red Flag mátrix:** a feltárt kockázatok („piros zászlók”) listája és értékelése.
- **Health Score:** 0–100, a pillérek súlyozott állapota; 100 = nincs azonosított kockázat.
- **Bruttó kitettség:** ha minden kockázat bekövetkezne, ennyi lenne a kár.
- **Várható veszteség:** kitettség × bekövetkezési esély.
- **Lényegességi küszöb:** e fölötti várható veszteség mindig piros.
- **DSO:** vevőállomány forgási ideje (hány nap alatt fizetnek a vevők).
- **Change of Control záradék:** tulajdonosváltáskor felmondási jogot adó szerződéses feltétel.
- **VDD / Buy-side DD:** eladói / vevői átvilágítás.
- **Pillér:** a négy vizsgálati terület (Pénzügy/Adó, Jog, Operáció, HR).
- **Kalauz:** a beépített segítő, amely a következő lépést mutatja.
- **Bemutató cég:** kitalált mintacég kész adatokkal, próbálgatáshoz.

## 14. Hol mi található (fejlesztőnek)

- Felület: `components/` (mátrix: `risk/RedFlagMatrix.tsx`; adatgyűjtés: `intake/`; interjúk: `interview/`; projekt, projektválasztó: `project/`; kalauz: `guide/`)
- Üzleti logika: `lib/` (motor: `risk/engine.ts`; forintosítás: `risk/valuation.ts`; katalógus: `risk/catalog.ts`, `risk/sectorRisks.ts`, `engagement/kindRisks.ts`; típusok: `engagement/kinds.ts`; adatgyűjtés: `intake/`; interjú: `interview/`; AI: `ai/`; tárolás: `risk/store.ts`, `projects.ts`, `storage.ts`)
- API: `app/api/` · Adatbázis: `supabase/migrations/` · Előnézet: `preview/`
- Dokumentáció: `docs/RENDSZERLEIRAS.md` (összefoglaló), `docs/07` (bővített modulok), `docs/08` (üzemeltetés), `docs/09` (AI-promptok)
