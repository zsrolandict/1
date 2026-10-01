# 11 · Javaslat: a következtetések nyomon követhetősége és bővebb alapadatok

A javaslat két kérdésre válaszol, amelyeket a bemutatón a végrehajtó oldali kollégák tettek fel:

1. **Honnan jön egy következtetés?** Egy-egy kockázatnál nem volt egyértelmű, mi alapján került be, és miért annyi a súlya.
2. **Több alapadat kellene.** Az utolsó lezárt beszámoló, a kiegészítő melléklet és a könyvvizsgálói jelentés is legyen csatolható, és a rendszer dolgozzon is belőlük.

**Állapot (2026. október):** mind a négy lépés elkészült (lásd 3. pont), a bétában kipróbálható. Ami még a szakértőkre vár: a küszöbök és paraméterek jóváhagyása, és a 4. pont nyitott kérdései. Részletes leírás: `docs/07-bovitett-modulok.md` (Bizonyíték-lánc, Pénzügyi alapadatok).

---

## 1. Nyomon követhetőség: minden következtetés útja legyen látható

### Mi van most

A rendszer már ma is ad forrást, de ez **egyetlen sorba sűrítve** látszik, és útközben információ vész el:

- Egy kockázatnál csak **egy forrás-címke** marad meg (pl. „AI · dokumentum”). Ha ugyanazt a kockázatot később a kérdőív is megerősíti, a címke felülíródik. Hogy két független forrás is jelezte, az nem látszik.
- A bizonyíték (idézet + oldalszám vagy időbélyeg) **egy szöveges mezőbe fűződik össze**, és a táblázatban csak egy dőlt sor mutatja.
- Ha egy már bepipált tételt egy új forrás súlyosabbnak lát, a pontszám emelkedik, de **nem látszik, melyik forrás emelte**.
- Az AI indoklása csak új tételnél kerül át. Meglévő tételnél elvész.
- Nincs rögzítve, **ki fogadta el** a javaslatot és mikor, illetve ki írta felül a pontszámot.
- A pontszám levezetése (megadott érték → típus-korrekció → lényegességi küszöb → besorolás) részben a sor lenyitásakor látszik, a Health Score számítása pedig sehol.

### Javaslat

**1.1 Bizonyíték-lánc tételenként.** A „forrás” és a „bizonyíték” szöveg helyett minden kockázat egy listát kap, és minden forrás külön bejegyzés benne:

| Mező | Példa |
|---|---|
| Forrás típusa | Dokumentum (AI) / Kérdőív (szabály) / Adattábla (szabály) / Keresztellenőrzés / Interjú (AI) / Cégkivonat / Kézi |
| Pontos hely | „Szoftverfejlesztési keretszerződés, 7. oldal” · „Q09 kérdés: *Igen*” · „Vevői korosítás: 180 napon túli arány 32% > 20% küszöb” · „Pénzügyi vezető interjú, 12:41” |
| Szó szerinti idézet | „A Megrendelő tulajdonosváltás esetén a szerződést azonnali hatállyal felmondhatja.” |
| Miért kockázat | a szabály szövege, vagy az AI indoklása |
| Hatás | valószínűség 3 → 4, kitettség +120 M Ft |
| Ki és mikor | „AI javasolta (bizonyosság 0,82) · Kiss Anna elfogadta, 2026.10.03.” |

**1.2 „Miért?” panel.** A sor lenyitásakor idővonal mutatja a forrásokat a fenti mezőkkel. A forrásra kattintva a rendszer odaugrik: a dokumentum fülön kiemelve az idézet, a kérdőívben a kérdés, az interjúnál az időbélyeg. A táblázatban egy kis jelző mutatja, hány független forrás erősíti meg a tételt (pl. „3 forrás”). Ez önmagában bizalmat ad.

**1.3 Ember, szabály vagy AI: mindig jelölve.** Más ikon jelzi a rögzített szabály eredményét, az AI-javaslatot és a szakértői döntést. AI-tétel csak „AI javasolta, X jóváhagyta” formában szerepelhet.

**1.4 Pontszám- és összeg-levezetés egy helyen.** A sorban egy „levezetés” sor:
megadott V×H (ki adta) → átvilágítás-típus miatti korrekció → lényegességi felülbírálat → besorolás.
A kitettségnél ugyanígy: képlet, paraméterek, és hogy melyik paraméter melyik forrásból jön. A Health Score mellett egy „hogyan számoltuk” magyarázat: pillér-súlyok és a pillérek pontjai.

**1.5 Változásnapló.** Rögzül, ki pipált be vagy ki egy tételt, ki írt felül pontszámot vagy összeget, és mikor. **Ha a szakértő csökkenti a súlyosságot, kötelező indoklást írni.** Ez később vitás helyzetben is véd.

**1.6 Fordított irány: forrásnézet.** Egy dokumentumnál, interjúnál vagy táblánál látszik, mely kockázatok születtek belőle.

**1.7 A riportban is.** A PDF és az Excel kap egy **„Bizonyítéktár”** mellékletet: tételenként a források, hivatkozással. Mellé jön egy **„Vizsgálati terjedelem”** fejezet is: mit láttunk (beérkezett iratok, interjúk), és mit nem (bekért, de be nem érkezett iratok). Amit nem láttunk, arról a riport ne állítson semmit. Ez felelősségi szempontból is fontos.

---

## 2. Bővebb alapadatok: mit érdemes bekérni, beírni, és mit kezdjen vele a rendszer

### Mi van most

Az iratbekérési lista ma is kéri a fontos iratokat (pl. B03: beszámolók 3 évre könyvvizsgálói jelentéssel, B04: főkönyvi kivonat, B09: hitelszerződések, B10: NAV-folyószámla, K07: függő kötelezettségek). **Feldolgozni viszont nem dolgozza fel őket célzottan.** A dokumentumelemzés általános: szerződéseket és szabályzatokat olvas, idézettel. A beszámolóból nem olvas ki számokat, és a könyvvizsgálói véleményt sem értelmezi. A bekérési lista és a feltöltött iratok sincsenek összekötve: a „Beérkezett” jelölést kézzel kell beállítani.

### Javasolt felépítés: három réteg

1. **Beírható kulcsadatok** (űrlap, AI nélkül): gyors, ha az irat nincs kéznél, vagy ha csak előszűrés kell.
2. **Célzott irat-feldolgozás**: feltöltéskor kiválasztod az irat típusát, vagy a rendszer felismeri. Típusonként megvan, mit kell kiolvasni és mit kell keresni. A kiolvasott értékeket **ember hagyja jóvá**, mint ma a cégkivonatnál.
3. **Szabályok és keresztellenőrzések** a kettőből: rögzített, szakértő által jóváhagyott küszöbökkel, javaslatként a mátrixba.

A feltöltött irat automatikusan „Beérkezett” lesz a bekérési listán. A hiányzó kötelező irat a riport „Vizsgálati terjedelem” fejezetébe kerül.

### 2.1 Új fül: „Pénzügyi alapadatok” (beszámoló-csomag)

| Irat | Mit olvasunk ki / mit keresünk | Mire jó |
|---|---|---|
| **Éves beszámoló, 3 év** (mérleg, eredménykimutatás) | Árbevétel, anyagjellegű és személyi jellegű ráfordítás, értékcsökkenés, üzemi és adózott eredmény; saját tőke, jegyzett tőke, eredménytartalék, céltartalék; rövid és hosszú lejáratú kötelezettségek, pénzeszköz, vevők, szállítók, készlet, tárgyi eszköz | Kulcsmutatók és trendek; a cégadatok (árbevétel, fedezet, fizetési idő) **automatikus kitöltése jóváhagyással** |
| **Kiegészítő melléklet** | Függő és jövőbeni kötelezettségek, kezesség, garancia, zálogjog; kapcsolt felekkel kötött ügyletek; peres ügyek; céltartalék oka; mérlegfordulónap utáni események; számviteli politika változása, korábbi évek jelentős hibái, önellenőrzés; vezetőknek adott előleg, kölcsön; tagi kölcsönök; átlagos létszám; lízing; támogatások | A mérlegen kívüli kockázatok legfontosabb forrása |
| **Könyvvizsgálói jelentés** | A vélemény típusa (minősítés nélküli / minősített / ellenvélemény / véleménynyilvánítás elutasítása); lényeges bizonytalanság a vállalkozás folytatására; figyelemfelhívás; kulcsfontosságú könyvvizsgálati kérdések | Közvetlen jelzés: nem tiszta vélemény vagy folytatási bizonytalanság → piros javaslat |
| **Könyvvizsgálói vezetői levél** (management letter), ha van | Belső kontroll hiányosságai, javasolt intézkedések | Sokszor itt van a legtöbb konkrét gyenge pont |
| **Üzleti jelentés** | Kockázatok, tervek, a vezetés saját értékelése | Összevetés az interjúkkal |
| **Beszámolót elfogadó és osztalékról szóló határozat**, letétbe helyezés dátuma | Osztalék a tőkehelyzethez képest; késedelmes letétbe helyezés | Formai és tőkevédelmi jelzések |
| **Főkönyvi kivonat** (már bekérjük) | Egyezés a beszámolóval; magas pénztár; tagi kölcsön; átfutó és függő számlák | Könyvelési minőség |
| **Tárgyévi időközi mérleg és eredménykimutatás** (K10, már bekérjük) | Ugyanaz, mint a beszámolónál | A legutóbbi lezárt év óta történt változás |

**Szabályok a beszámolóból** (küszöbök szakértői jóváhagyással, ahogy ma a képlet-paraméterek is):

- A saját tőke negatív, vagy a jegyzett tőke alá csökkent. Ez a Ptk. tőkevédelmi szabályai miatt jogi teendőt is jelenthet; a pontos feltételt jogász hagyja jóvá.
- Az árbevétel nagyot esett az előző évhez képest.
- Romló EBITDA-ráta.
- Magas adósság/EBITDA arány.
- Gyenge likviditás (forgóeszköz / rövid lejáratú kötelezettség).
- Tartósan nagy eltérés az eredmény és a pénzeszköz-változás között.
- A mérlegből számolt vevői és szállítói fizetési idő romlik.

### 2.2 Adó, hatóság, finanszírozás

| Irat / adat | Mit nézünk |
|---|---|
| **NAV-folyószámla** (B10, már bekérjük) | Tartozás, késedelmi pótlék, fizetési könnyítés |
| **Köztartozásmentes adózói státusz** | Beírható igen/nem |
| **NAV- és egyéb hatósági ellenőrzések** jegyzőkönyvei, határozatai (K18) | Megállapítás, bírság, ismétlődés |
| **Önellenőrzések listája** | Gyakoriság, összeg |
| **ÁFA-bevallás vs. NAV Online Számla** egyeztetés | Eltérés (ma kérdőív-kérdés, lehetne számszerű is) |
| **Társasági adó- és iparűzésiadó-bevallás vs. beszámoló** | Az adóalap és a beszámoló egyezése |
| **Támogatási szerződések** (új) | Fenntartási idő vége, visszafizetési feltételek, tulajdonosváltáshoz kell-e hozzájárulás. **Eladásnál gyakori, rejtett kockázat.** |
| **Hitel-, lízing-, garanciaszerződések** (B09, K09) | Lejárat, kovenánsok és teljesülésük, tulajdonosváltási (change of control) záradék, biztosítékok |
| **Zálogjogok** (hitelbiztosítéki nyilvántartás) (új) | Terhelt eszközök |

### 2.3 Beírható tételek (ha nincs irat, vagy előszűréshez)

- Pénzügyi kulcsszámok 3 évre (rövid táblázat: árbevétel, EBITDA, adózott eredmény, saját tőke, jegyzett tőke, kötelezettségek, pénzeszköz, vevők, szállítók, készlet).
- Könyvvizsgálói vélemény típusa, van-e figyelemfelhívás vagy folytatási bizonytalanság.
- NAV-tartozás összege; köztartozásmentes-e.
- Függő kötelezettségek (kezesség, garancia) összege.
- Folyamatban lévő perek száma és perértéke.
- Támogatások: összeg, fenntartási idő vége.
- Hitelek: összeg, lejárat, teljesülnek-e a kovenánsok, van-e change of control záradék.
- Tagi és tulajdonosi kölcsönök egyenlege.
- Utolsó NAV-ellenőrzés éve és eredménye.
- Felelősségbiztosítás: van-e, mekkora a limit.
- Kulcsemberek száma, éves fluktuáció.

Mindegyikhez jár egy forrásmező („honnan tudjuk”: irat, interjú, ügyfél szóbeli közlése). Így a beírt adat is nyomon követhető marad.

### 2.4 Keresztellenőrzések, amikből a rendszer „dolgozik”

| Összevetés | Jelzés |
|---|---|
| Beszámoló árbevétele ↔ vevőnkénti árbevétel tábla összege | Nagy eltérés: hiányos tábla vagy nem könyvelt bevétel |
| Mérleg vevőállománya ↔ vevői korosítás összege | Eltérés |
| Melléklet kapcsolt ügyletei ↔ kapcsolt ügyletek tábla, transzferár-nyilvántartás | Hiányzó ügylet vagy nyilvántartás |
| Melléklet függő kötelezettségei ↔ kérdőív vagy interjú („nincs kezesség”) | Ellentmondás |
| Melléklet peres ügyei ↔ perlista (B13) és tényállás | Ellentmondás |
| Melléklet átlagos létszáma ↔ bérkimutatás ↔ tényállás | Eltérés (színlelt szerződések gyanúja) |
| Könyvvizsgálói figyelemfelhívás ↔ pénzügyi tételek | A pénzügyi pillér tételei súlyosabbak |

Ezek ugyanúgy javaslatként kerülnek a mátrixba, mint ma, **bizonyíték-lánccal** (1.1): melyik két forrás, melyik szám, mennyi az eltérés.

### 2.5 További irattípusok célzott ellenőrzőlistával

A már bekért iratoknál is érdemes típusonként rögzíteni, mit kell keresni (ma ezt az AI általánosan teszi). Ez a kimenetet egységesebbé és ellenőrizhetőbbé teszi:

- **Létesítő okirat, szindikátusi szerződés:** elővásárlás, hozzájárulási jogok, vétójog, drag/tag-along.
- **Hitelszerződés:** kovenánsok, change of control, biztosítékok, felmondási okok.
- **Ügyfél- és szállítói szerződés:** felelősségkorlátozás, kötbér, change of control, kizárólagosság, felmondás.
- **Munkaszerződés, megbízási szerződés:** versenytilalom, szellemi tulajdon átruházása, munkarend (színlelés).
- **Bérleti szerződés, tulajdoni lap:** lejárat, terhek, opciók.
- **Biztosítási kötvény:** limit, kizárások, lejárat.
- **Adatkezelési nyilvántartás, adatfeldolgozói szerződések:** hiányzó adatfeldolgozói szerződés, külföldre továbbítás.

---

## 3. Sorrend és megvalósítás

Mind a négy lépés elkészült:

1. **Kész:** bizonyíték-lánc, „Miért?” panel, levezetés (tétel és Health Score), változásnapló kötelező indoklással, forrásnézet.
2. **Kész:** „Pénzügyi alapadatok” fül, beírható kulcsszámok és tények, irattípusos kiolvasás jóváhagyással, 20 szabály (PA-01…PA-20) és keresztellenőrzések.
3. **Kész:** feltöltés → „Beérkezett”; PDF: „A vizsgálat terjedelme” és „Bizonyítéktár”; Excel: Bizonyítéktár, Változásnapló, Vizsgálati terjedelem.
4. **Kész:** adó, hatóság, finanszírozás, támogatás (beírható tények, szabályok, új bekérési tételek), 23 irattípus célzott ellenőrzőlistával.

Az eredeti javaslat szerinti sorrend:

1. **Bizonyíték-lánc + „Miért?” panel + levezetés + változásnapló** (1.1–1.5). Ez közvetlenül a kollégák kérdésére felel, és minden későbbi forrás erre épül.
2. **Pénzügyi alapadatok fül:** beírható kulcsszámok (2.3), beszámoló, melléklet és könyvvizsgálói jelentés célzott kiolvasása jóváhagyással (2.1), az első szabályok és keresztellenőrzések (2.4).
3. **Iratbekérés összekötése a feltöltéssel** + **„Vizsgálati terjedelem” és „Bizonyítéktár” a riportban** (1.7).
4. **Adó, hatóság, finanszírozás, támogatások** (2.2) és a típusonkénti ellenőrzőlisták (2.5).

## 4. Nyitott kérdések a kollégákhoz

- Mely küszöböket használják ma (árbevétel-esés, adósság/EBITDA, likviditás, eltérési tűrés)? Ezeket szakértői paraméterként rögzítenénk, jóváhagyással.
- Milyen formában kapják meg jellemzően a beszámolót: e-beszámoló PDF, könyvelőprogramból exportált táblázat, vagy szkennelt irat? Szkennelthez szövegfelismerés (OCR) kell.
- Melyik irat hiányzik leggyakrabban, és mit csinálnak ilyenkor?
- Kell-e a bizonyíték-láncba az ügyfél szóbeli közlése mint forrás, és ha igen, ki rögzítheti?
- A változásnaplóban elég a név és az időpont, vagy a korábbi érték is kell?

## Adatvédelem

A beszámoló nyilvános irat. A kiegészítő mellékletben és a könyvvizsgálói levélben viszont lehet személyes adat (vezetők javadalmazása, kölcsönei). Ezeket a meglévő maszkolás kezeli. Valódi ügyféladat csak az éles, EU-s, adatfeldolgozási szerződéssel (DPA) rendelkező környezetben kerülhet be (lásd `docs/08`).
