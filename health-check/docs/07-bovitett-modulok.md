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
