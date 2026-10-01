# 07 · Bővített modulok

Ez a leírás az alapmodulok (Red Flag mátrix, interjú, adatgyűjtés) utáni bővítéseket foglalja össze. Minden modul a kalauzban (**Modulok** fül) ki- és bekapcsolható. A Red Flag mátrix mindig bekapcsolt, mert a többi modul ebbe dolgozik.

Jelmagyarázat: **Kézi** = szabályalapú, AI nélkül. **AI** = a modell javasol, a szakértő dönt. Minden AI-találathoz szó szerinti idézet kell a forrásból; a rendszer kiszűri azt, amelyiké nem igazolható.

| Modul | Hol | Típus | Kód |
|---|---|---|---|
| Tényállás és iratbekérés | Adatgyűjtés › 0. fül | Kézi (+AI-javaslat a leírásból) | `lib/intake/requests.ts`, `casePrompts.ts` |
| Ágazati katalógusok | Mátrix, kérdőív, iratlista | Kézi | `lib/risk/sectorRisks.ts`, `lib/intake/checklist.ts` (`SECTOR_QUESTIONS`) |
| Cégkivonat | Adatgyűjtés › Tényállás | AI (kiolvasás) + szabályok | `lib/intake/registry.ts` |
| Összkép | Adatgyűjtés › 4. fül | Kézi keresztellenőrzés + AI-szintézis | `lib/intake/crossChecks.ts`, `synthesis.ts` |
| Mi lenne, ha… | Mátrix, lent | Kézi | `lib/risk/simulate.ts` |
| Vevői kérdéslista | Mátrix, lent (és Excel) | Kézi | `lib/report/buyerQuestions.ts` |
| Utókövetés | Mátrix, lent | Kézi | `lib/risk/followup.ts` |
| Időkeret | Projekt oldal | Kézi | `lib/timesheet/timesheet.ts` |
| Tudástár | Projekt oldal | Kézi | `lib/learning/benchmark.ts` |
| Kalauz és modulkapcsolók | Jobb alsó sarok, minden oldalon | Kézi | `lib/guide.ts`, `lib/modules.ts`, `components/guide/` |
| Projektkezelés és mentés | Felső sáv, jobbra | Kézi | `lib/risk/store.ts`, `lib/projects.ts`, `components/project/ProjectBar.tsx` |

## Tényállás és iratbekérés

- **Mit rögzítünk:** az első egyeztetés után az ágazatot (több is lehet), a létszámot, a jellemzőket (pl. generációváltás, több tulajdonos, közbeszerzés) és egy rövid leírást.
- **Iratlista:** az alap iratkör minden projektben szerepel. A típus, az ágazat és a jellemzők további iratokat tesznek hozzá. Minden irat mellett ott az indok.
- **Állapotok:** bekérve, beérkezett, hiányzik, nem releváns. A hiányzó iratokra az interjúterv külön rákérdez.
- **AI-javaslat:** a szabad szöveges leírásból ágazatot, jellemzőket és extra iratot javasol, idézettel.

## Ágazati katalógusok

Hat ágazat saját kockázati tételeket kap (EPI, ITF, KON, GYA, TAN, KER), és hozzájuk ágazati kérdéseket a kérdőívben. Az ágazat kiválasztásakor a hiányzó ágazati tételek bekerülnek a mátrixba, azonosítatlanként.

## Cégkivonat

- **Beolvasás:** az e-cégjegyzék ingyenes cégkivonatát bemásolod vagy feltöltöd. Az AI kiolvassa belőle a tulajdonosokat, a vezetőket, az eljárásokat, a székhelyszolgáltatást és az elmúlt 3 év változásait.
- **Szabályok:**
  - folyamatban lévő eljárás esetén piros javaslat;
  - két éven belül legalább kétszer változott a vezetés: javaslat;
  - ellentmondás, ha a kérdőív szerint egy tulajdonos van, a cégjegyzék szerint több;
  - a TEÁOR-kódból ágazati javaslat.
- **Automatikus lekérés adószám alapján:** szerződéses adatszolgáltató kell hozzá. A bekötési pont a `CompanyRegistryProvider`.

## Összkép

- **Keresztellenőrzés (szabályok):** összeveti a forrásokat. Például a kérdőív szerint nincs vevőkoncentráció, a vevőtábla szerint viszont a legnagyobb vevő 40% fölött van. Az eltérés ellentmondásként jelenik meg, súlyossággal.
- **AI-szintézis:** az összes forrásból a cégre szabott, egyedi kockázatokat javasol. Minden javaslathoz legalább egy ellenőrzött hivatkozás kell a forrásra.

## Mi lenne, ha…

Kiválasztod, mely tételek javulnak (megoldódnak vagy egy szinttel enyhülnek), és a program kiszámolja az új Health Score-t, a piros tételek számát, a várható veszteség csökkenését és a javítás becsült díját. Gyorsgombok: „Összes piros”, „Gyors javítások”.

## Vevői kérdéslista

Minden piros és sárga tételhez elkészíti a várható vevői kérdéseket, egy válaszvázlatot (a javítás állapotával) és a szükséges iratok listáját. Eladói és vevői átvilágításnál külön munkalapként az Excel-exportba is bekerül.

## Utókövetés

- **Javítási állapot tételenként:** nyitott, folyamatban, kész, elfogadott kockázat.
- **Pillanatkép:** a zárásakor mentett állapot.
- **Összevetés 3–6 hónap múlva:** mi oldódott meg, mi javult, mi romlott, mi új.
- **Adatbázis:** `assessment_snapshots` (0008-as migráció).

## Időkeret

- **Keret:** a típus óraszáma pillérenként (a súlyok szerint), plusz 2 óra projektvezetés.
- **Rögzítés:** dátum, terület, szerepkör, név, óra (negyedórás pontossággal, legfeljebb 12 óra bejegyzésenként), tevékenység.
- **Riasztás:** 80%-os felhasználásnál sárga, túllépésnél piros jelzés.
- **Költség és fedezet:** szerepkörönkénti belső óraköltségből. Ezek **tervezet** értékek (partner 25 000, szenior 15 000, junior 9 000 Ft/óra), a vezetés véglegesíti őket. A fedezet a díjhoz mért (alapból 1,2 M Ft); veszteséges projektnél a program figyelmeztet.
- **Adatbázis:** `timesheet_entries`, `hour_budgets` és a `v_engagement_burn` / `v_pillar_burn` nézetek (0001). A 0009-es migráció hozzáadja a `work_role` oszlopot.

## Tudástár

- **Felvétel:** a lezárt projektet egy gombbal felveszed, **anonimizálva**. Csak ez kerül be: a típus, az ágazat, az árbevétel-sáv (500 M alatt, 0,5–2 Mrd, 2–10 Mrd, 10 Mrd felett) és a katalógustételek besorolása (valószínűség, hatás, szín).
- **Ami nem kerül be:** cégnév, adószám, összeg, bizonyíték, idézet és az egyedi tételek címe. Egyedi tételből csak annyi marad, hogy volt ilyen.
- **Mit mutat:**
  - a leggyakoribb tételeket típus, ágazat és méret szerint szűrve;
  - a hasonló projektekben gyakori (legalább 50%-ban előforduló), de itt nem jelölt tételeket („érdemes rákérdezni”);
  - **katalógus-kalibrálási javaslatot:** ha egy tétel legalább 3 projektben szerepelt, és az átlagos értékelés legalább 1 ponttal eltér a katalógus alapértékétől. A katalógust a szakértő módosítja, a program csak jelez.
- **Bemutató rekordok:** a négy kitalált mintaesetből készült rekordok („bemutató”) kikapcsolhatók.
- **Adatbázis:** `benchmark_records` (0009). Nincs benne `engagement_id`, így a projekt nem kereshető vissza. A kettős felvételt egy sózott hash szűri. Belső munkatárs olvashatja; partner vagy menedzser vehet fel; partner törölhet.

## Kalauz és modulkapcsolók

- **Kalauz:** a jobb alsó sarokban, minden oldalon ott van.
  - **Merre tovább:** a projekt állapotából megmutatja a következő lépést, és az „Odaviszlek” gomb a megfelelő oldalra és fülre ugrik.
  - Mutatja a lépések listáját, kész és hátralévő jelöléssel, és ad oldalankénti tippeket.
  - Semmit nem módosít, csak vezet.
- **Modulkapcsolók:** a kikapcsolt modul kimarad a menüből, az oldalról és a kalauz lépései közül. Az adatai megmaradnak: visszakapcsolva újra látszanak. Ha egy oldal minden modulja ki van kapcsolva, az oldal is eltűnik a menüből.
- **Tárolás:** a prototípus a böngészőben tárolja a kapcsolókat; élesben projektenként az `engagements.disabled_modules` oszlopban lesznek (0009).

## Projektkezelés és mentés

- **Új projekt:** a felső sáv projektválasztójában („Új projekt”): cégnév és átvilágítás-típus. Üres katalógussal indul: semmi nincs bejelölve, mintaadat (tények, minta-interjú, minta-gombok) nincs benne.
- **Bemutató:** a négy kitalált cég külön csoportban. A rajtuk végzett módosítás megmarad; a visszaállítás (↺) csak megerősítés után történik.
- **Projektenkénti tárolás:** minden modul (mátrix, adatgyűjtés, interjúk, pillanatképek, időkeret) a projekt azonosítója alatt ment, így a projektváltás semmit nem ír felül. A korábbi, egyprojektes mentés első induláskor automatikusan bemutató projektté alakul, adatvesztés nélkül.
- **Megerősítés:** a mátrix „Alaphelyzet” gombja, a projekt törlése és a bemutató visszaállítása külön ablakban kérdez rá (nem a böngésző `confirm()`-ja, mert az beágyazott keretben tiltva lehet).
- **Mentésjelző:** „Helyben mentve – 2 perce”. Kattintásra elmagyarázza, hogy az adatok csak ebben a böngészőben vannak, és innen menthető a projekt fájlba (JSON). Saját projektnél sárga jelzés, ha még nem volt fájlba mentés, vagy 7 napnál régebbi és azóta módosult. Visszatöltés: projektválasztó › „Projekt visszatöltése fájlból…” – mindig új projektként, meglévőt nem ír felül.
- **Kalauz:** bemutató projektnél a „Tényállás rögzítése” lépésnél „Minta tényállás betöltése” gomb.
- **Órarögzítés:** a rögzítő a bejelentkezett felhasználó (Supabase-profil neve és szerepköre). Bejelentkezés nélkül (fejlesztői gép, előnézet) a felhasználó egyszer megadja a nevét, ez a böngészőben megmarad.

## Szerveroldali védelmek

- **Adatkezelési kapcsoló:** éles buildben (`NODE_ENV=production`) az AI-végpontok zárva vannak, amíg az üzemeltető be nem állítja az `AI_DPA_CONFIRMED=1` értéket, vagyis azt, hogy a beállított AI-szolgáltatóval adatfeldolgozói szerződés van, fizetős, EU-s adatkezeléssel. Ingyenes Gemini-kulccsal ezt nem szabad beállítani. Fejlesztői gépen (`npm run dev`) nincs korlát.
- **Hívásszám-korlát:** felhasználónként óránként 40 AI-hívás és 10 leiratkészítés (felülírható: `AI_RATE_LIMIT_PER_HOUR`, `TRANSCRIBE_RATE_LIMIT_PER_HOUR`). Túllépéskor 429-es válasz, `Retry-After` fejléccel. A számláló egy szerverpéldányon belül érvényes; több példánynál közös tár kell.
- **Tömörítési bomba elleni védelem:** DOCX és XLSX kicsomagolása legfeljebb 80 MB-ig, és gyanúsan nagy tömörítési arány (200× felett, 1 MB feletti fájlnál) esetén elutasítás (`lib/intake/safeUnzip.ts`).

## Több projekt egyszerre, folytatás

- **Laponként külön projekt:** az aktív projekt böngészőlaponként tárolódik, így két lapon két különböző projekt lehet nyitva, és az egyik lapon történő váltás nem viszi el a másikat. Új lap a legutóbb használt projekttel indul.
- **Projektjeim** (projektválasztó › „Projektjeim – hol tartok, folytatás…”): minden projekt haladása (kalauz-lépések), következő lépése, az azonosított tételek száma, és egy „Folytatás” gomb, ami azon az oldalon nyitja meg, ahol legutóbb abbahagytad. Az „Új lapon” gomb (a Next-alkalmazásban) külön lapon nyitja meg (`?projekt=<azonosító>`).
- **Hol tartottál:** projektenként megjegyzi az utoljára nyitott oldalt. Új saját projekt az Adatgyűjtéssel indul, bemutató a mátrixszal.
- **Ütközésjelzés:** ha ugyanazt a projektet egy másik lapon is módosítják, sárga sáv jelzi, „Frissítés” gombbal.

## Első élmény és üres állapotok

- **Üdvözlő kalauz** első látogatáskor („Kezdés” nézet): „Új ügyfél indítása”, „Folytatás, ahol abbahagytad” (legutóbbi 3 projekt), „Körbenézek a bemutatóban”.
- **Még nincs értékelés:** amíg egyetlen tétel sincs bepipálva, a mátrix nem mutat „Zöld / 100” eredményt, hanem teendőt (Adatgyűjtés indítása, kézi bepipálás). PDF- és Excel-export előtt ilyenkor rákérdez.
- **Üres cégadatok** új projektnél: nincs kitalált árbevétel; amíg nincs megadva, sárga keret és magyarázat jelzi, hogy forintosítás nincs.
- **Mentés-figyelmeztetés** csak akkor, ha a projektben már van munka, és egy napnál régebbi (vagy az utolsó fájlba mentés 7 napnál régebbi).

## Akadálymentesség

- A mátrix címsora szöveg (a cégnév ceruza gombbal szerkeszthető), így a képernyőolvasó is felolvassa.
- A színek mellett szöveg: „5 piros · 2 sárga · 0 zöld”, a pillérkártyákon a besorolás neve, a hőtérkép celláin felolvasható leírás.
- Olvasandó szöveg legalább `slate-500` (a korábbi `slate-400` helyett), legkisebb betűméret 12 px; minden beviteli mezőn látható fókusz.
- A mobil nézetet szándékosan nem optimalizáljuk: a program asztali munkára készül.

## Érthető szöveg és letisztult mátrix

- **Magyarázó ⓘ ikonok** a szakkifejezések mellett (Health Score, összesített státusz, bruttó kitettség, várható veszteség, pontszám, lényegességi küszöb, fedezeti hányad, fizetési idő / DSO, súly, típusfüggő korrekció, kiemelt tételek, Red Flag mátrix). A szövegek egy helyen vannak (`lib/glossary.ts`), és a motor tényleges szabályait írják le.
- **Kódok helyett nevek:** a „Fókusz: FIN-01…” sor helyett „Kiemelt tételek” a tételek nevével; a javasolt tételek gombjain a név; a sorokban „Kiemelt” címke; a típusfüggő korrekció szövegesen („a cél miatt valószínűség +1 → 5 × 4”).
- **A mátrix teteje:** fejléc → eredmény (státusz, Health Score, összegek, pillérek, hőtérkép) → javasolt további tételek → összecsukható „Cégadatok és átvilágítás-típus” doboz (egy sorban összefoglalva; nyitva, ha hiányzik az árbevétel) → kockázati tételek.

## Bizonyíték-lánc: minden következtetés útja

- **Mit tud:** minden kockázati tételhez forráslista. Minden forrás külön bejegyzés: típus (kérdőív, adattábla, dokumentum, interjú, összkép, cégkivonat, pénzügyi alapadat, szakértői döntés), ki javasolta (szabály, AI, szakértő), pontos hely (irat és oldal, kérdés és válasz, táblamutató és küszöb, interjú-időbélyeg), szó szerinti idézet, indoklás, hatás a pontszámra, ki fogadta el és mikor, AI-nál a bizonyosság.
- **Miért? panel** (a sor lenyitásakor): idővonal a forrásokkal, **Megnyitás** gomb a forrásra (kiemeléssel), a pontszám és a várható veszteség **levezetése** lépésenként, és a **szakértői módosítások** naplója. A Health Score számítása a pillérek alatt lenyitható.
- **Változásnapló:** a kézi pipálás és a pontszám/összeg módosítása naplózva (ki, mikor, mit). Ha a szakértő **csökkenti** a súlyosságot, indoklást kell írnia; amíg nincs, a sorban „Indoklás hiányzik” jelvény látszik, és a riport belső jelzése felsorolja.
- **Forrásnézet:** a dokumentumnál, táblánál és a pénzügyi adatoknál „Ebből a mátrixban” – kattintásra a mátrix sorára ugrik.
- **Riport:** a részletező kártyákon a források (legfeljebb kettő), a PDF végén **Bizonyítéktár** melléklet, az Excelben Bizonyítéktár és Változásnapló munkalap.
- **Kód:** `lib/risk/trail.ts`, `lib/risk/derivation.ts`, `components/risk/EvidencePanel.tsx`, `lib/focus.ts`. Régi mentésnél a szöveges bizonyítékból egy bejegyzés lesz.
- **Adatbázis:** `red_flags.evidence_trail`, `red_flags.change_log` (0010).

## Levezetés-munkafüzet (Excel, élő képletekkel)

- **Mit tud:** a Red Flag mátrix „Levezetés” gombja egy Excel-munkafüzetet ad, amely **ugyanazt számolja, mint a program**, de látható képletekkel: tételenként megadott érték → típus-korrekció → pont → sáv → kitettség (képlet szerint vagy kézzel) → esély → várható veszteség → lényegességi küszöb → végső besorolás → időablak, prioritás, Health-szorzó; a Pillérek lapon pillér-egészség és súlyozott Health Score.
- **Sárga cella = bemenet** (valószínűség, hatás, „Azonosítva”, kitettség-paraméterek, árbevétel, küszöbök, esély-tábla, súlyok): átírható, és látszik, mi változik. A fehér cellák képletek. Megnyitáskor az Excel újraszámol.
- **Munkalapok:** Útmutató, Levezetés, Pillérek, Paraméterek, Vélemények (ha van), Bizonyítéktár, Változásnapló.
- **Garancia:** teszt (`lib/report/derivation.test.ts`) minden bemutató cégnél táblázatkezelő-motorral (HyperFormula) kiértékeli az összes képletet, és összeveti a program eredményével; a „mi lenne, ha” módosításokat (tétel kivétele, árbevétel átírása) is.
- **Fontos:** a munkafüzetben végzett módosítás nem kerül vissza a programba; ott változásnaplóval, indoklással kell átvezetni.
- **Kód:** `lib/report/derivationWorkbook.ts`, `lib/report/xlsx.ts` (képletes cellák).

## Feltevések: nincs rejtett állandó

- **Mit tud:** minden módszertani szám egy helyen (`lib/risk/assumptions.ts`): katalógus-alapértékek, esély-tábla (1→5%, 2→20%, 3→40%, 4→65%, 5→90%), pontszám-sávok, lényegességi küszöb, Health-szorzó (1 − pont/25 × 0,6), pillér-besorolás (40/70), pillérsúlyok, típus-korrekciók, prioritás (0,5 × pont/25 + 0,5 × várható veszteség/legnagyobb + 0,15 quick win), quick win és időablak, kitettség-képletek, szakértői paraméterek, pénzügyi küszöbök. Mindegyiknél: érték, mire hat, honnan jön, **állapot** (jóváhagyva / kezdő javaslat), felelős, kód.
- **Hol látszik:** a Miért? panel Levezetés részének alján („Feltevések a levezetésben”), és a levezetés-munkafüzet „Feltevések” lapján.
- **A levezetés teljes:** a megadott érték forrása (katalógus-alapérték = szakértői becslés, ha nincs forrás), típus-korrekció, pont, kitettség, várható veszteség, küszöb, besorolás, **időablak** (miért), **prioritás** (a képlet a tétel számaival), **hatás a pillér-egészségre**.
- **Őszintén:** egyik állandó sincs lezárt projektek tényleges kimenetén kalibrálva. Az AI „bizonyossága” önbecslés, ezért „AI-önbecslés (nem kalibrált)” a neve, és a pontszámba nem számít bele.
- **Ami ítélet marad** (dokumentálva, de nem kiszámolható): az AI által javasolt 1–5 érték és kitettség, az AI önbecslése, a felülvizsgálat érvelése, a leirat minősége, a szakértő saját döntése. Mindegyiknél a kezelés: idézet-ellenőrzés, kézi elfogadás, változásnapló, indoklás.
- **Teszt:** `lib/risk/assumptions.test.ts` (a kiírt értékek a motor tényleges állandói), `lib/risk/trail.test.ts` (a prioritás és a Health-szorzó levezetése egyezik a motorral).

## Vélemény és kritikus felülvizsgálat

- **Mit tud:** a Miért? panel alján a tanácsadó véleményt fűzhet a tétel eredményéhez („Szerintem túlzó, mert…”). Két lehetőség: **Csak megjegyzés** (rögzül, semmit nem változtat), vagy **Kritikus felülvizsgálat kérése**: az AI a véleményt a tétel forrásaival és levezetésével veti össze.
- **Nem szolgai:** a prompt kimondja, hogy a vélemény nem bizonyíték, a tanácsadó tekintélye nem érv, ne udvariaskodjon, és mindig írja le a legerősebb ellenérvet. Ítélet: egyetért / részben / nem ért egyet / bizonyíték kell; mellé: ellenérvek, milyen irat igazolná, hivatkozott források, javaslat (valószínűség, hatás, kitettség).
- **A program ellenőrzi az AI-t** (`verifyReview`), nem csak a prompt kéri:
  - hivatkozás csak létező forrásra, és az idézetnek szó szerint szerepelnie kell abban a forrásban – különben elvetve;
  - súlyosság-**csökkentő** javaslat ellenőrizhető hivatkozás nélkül elvetve;
  - „egyetért” ellenőrizhető hivatkozás nélkül → „bizonyíték kell”;
  - a változatlan értéket javaslatként nem mutatja.
  Az elvetett elemek a kártyán „A program ellenőrzése után kimaradt” alatt látszanak.
- **Semmi nem automatikus:** a javaslat csak **Átvétel**-lel lép életbe; ekkor a változásnaplóba kerül, indoklásként a vélemény és a felülvizsgálat szövegével. Elvetésnél a döntés is rögzül (ki, mikor).
- **Következmény:** forrás nélküli (katalógus-alapértékből indult) tételnél az AI nem javasolhat enyhítést: előbb bizonyítékot kell csatolni, vagy a tanácsadó kézzel módosít, indoklással – a felelősség így nála marad.
- **Riport:** a levezetés-munkafüzet „Vélemények” lapja (vélemény, ítélet, elvetett elemek, javaslat, döntés).
- **Kód:** `lib/risk/review.ts`, `app/api/risk/review/route.ts`, `components/risk/EvidencePanel.tsx` (OpinionThread, ReviewCard). **Adatbázis:** `red_flags.discussion` (0011).

## Pénzügyi alapadatok

- **Mit tud:** az Adatgyűjtés új fülén a beszámoló kulcsszámai legfeljebb 3 évre (eredménykimutatás és mérleg főbb sorai), mutatók (EBITDA, EBITDA-ráta, árbevétel-változás, nettó adósság/EBITDA, likviditási ráta, saját tőke/jegyzett tőke, vevői és szállítói fizetési idő, fedezeti hányad közelítése), és beírható tények öt csoportban: könyvvizsgálat és beszámoló, adó és hatóság, jogviták és függő kötelezettségek, finanszírozás és támogatás, létszám és biztosítás. Minden érték mellett a forrása (irat oldallal és idézettel, kézi bevitel, ügyfél szóbeli közlése, interjú, nyilvános adat).
- **Iratból:** a Dokumentumok fülön az irattípus kiválasztásával (pl. éves beszámoló, kiegészítő melléklet, könyvvizsgálói jelentés) az AI kiolvassa a számokat és tényeket; ezek „jóváhagyásra várnak” a Pénzügyi alapadatok fülön, idézettel. Átvétel vagy elvetés a tanácsadó döntése.
- **Szabályok** (`lib/intake/financials/rules.ts`, sablonok: `lib/risk/financialRisks.ts`, PA-01…PA-20): nem tiszta könyvvizsgálói vélemény, folytatási bizonytalanság, tőkevesztés, árbevétel-esés, romló EBITDA, eladósodottság, gyenge likviditás, adótartozás, adóellenőrzési megállapítás, függő kötelezettség, perek, támogatás fenntartási kötelezettséggel, hitelkovenáns / tulajdonosváltási záradék, közeli hitellejárat, tagi kölcsön, késedelmes letétbe helyezés, osztalék gyenge tőke mellett, vezetői levél hiányosságai, felelősségbiztosítás hiánya, beszámoló ↔ adattábla eltérés. Cégadat-javaslat: árbevétel, fedezeti hányad, tényleges fizetési idő a beszámolóból.
- **Küszöbök** (`thresholds.ts`): kezdő javaslatok, szakértői jóváhagyásra várnak; a riport módszertana jelzi.
- **Iratbekérés:** a feltöltött irat a típusa szerinti bekérési tételt „Beérkezett”-re állítja (a „Nem releváns” marad). Új bekérési tételek: kiegészítő melléklet és üzleti jelentés, könyvvizsgálói jelentés és vezetői levél, beszámolót elfogadó határozatok, adóigazolás, önellenőrzések, támogatási szerződések, zálogjogok, adóbevallás és beszámoló egyeztetése.
- **Riport:** új fejezet „A vizsgálat terjedelme” – mit láttunk (iratok, táblák, interjúk, beszámoló-évek) és mit nem (bekért, de be nem érkezett iratok); az Excelben külön munkalap.
- **Bemutató:** a 4 kitalált céghez kitalált beszámoló-csomag (beszámoló, melléklet, könyvvizsgálói jelentés) a Dokumentumok fülön.
- **Adatbázis:** `financial_profiles` (pénzügyi pillér szerinti jogosultsággal), `documents.doc_type` (0010).

