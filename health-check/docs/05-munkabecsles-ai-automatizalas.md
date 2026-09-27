# AI-automatizált Health Check – munkabecslés, kockázatok és adatvédelmi terv

> **Tárgy:** a jelenlegi prototípusból egy nagyrészt automatizált, élesben használható rendszer. Az ügyfél feltölt és kitölt, a rendszer előjelöl, a szakértő ellenőriz és jóváhagy.
> **Cél:** adatvédelmi szempontból maradéktalanul megfelelő rendszer.
> **Pontosság:** a becslések ±25%-os sávban értendők; a díjtételek feltételezések, lásd a 10. fejezetet.

---

## 1. Vezetői összefoglaló

| | Teljes változat | Karcsú változat (Microsoft 365-re építve) |
|---|---|---|
| **Fejlesztési ráfordítás** | 161–235 fejlesztői nap | 139–205 fejlesztői nap |
| **Egyszeri költség** (középárral, külső tételekkel) | **~28–42 M Ft** | **~24–38 M Ft** |
| **Átfutás** (2 fejlesztő + részidős adatvédelmi szakértő) | ~5–6 hónap | ~4,5–5,5 hónap |
| **Futó költség** | ~0,4–0,9 M Ft/hó | ~0,4–0,8 M Ft/hó |
| **AI-költség projektenként** | néhány ezer Ft | ugyanaz |

**Mit kap érte az ICT?** Az ügyfél a dokumentumokat és a kérdőívet egy biztonságos felületen adja le. A rendszer:
- kiolvassa a szerződések kulcspontjait és a főkönyv kulcsszámait, oldal-hivatkozással;
- előjelöli a kockázatokat, és előre kiszámolja a forintosítást;
- feldolgozza az interjúkat, és jelzi az ellentmondásokat.

A szakértő munkája a kitöltés helyett **ellenőrzés és jóváhagyás** lesz. Reális cél, hogy egy projekt ~21 óráról **~12–14 órára** csökkenjen.

**A „100%-os adatvédelemről”.** Olyan rendszer nem létezik, amelyre garantálni lehet, hogy soha semmi nem történik vele. Adatvédelmi szempontból a teljes megfelelés azt jelenti, hogy:
- minden adatkezelésnek van jogalapja, dokumentációja és felelőse;
- a kockázatokat felmértük és a vállalható szintre csökkentettük;
- ezt bármikor igazolni tudjuk a hatóságnak és az ügyfélnek.

Ez a terv ezt célozza. A 7. fejezet pontos „kész” feltételeket ad, amelyek teljesülése mérhető.

**A három legfontosabb adatvédelmi döntés:**
1. **Minden adat az EU-ban marad**, az AI-feldolgozással együtt. Ehhez a Claude-ot EU-régiós felhőn keresztül kell használni, nem közvetlenül.
2. **Az AI-hoz csak a szükséges, lehetőség szerint álnevesített szöveg megy.** Neveket, azonosítókat és bankszámlaszámokat a rendszer még az elküldés előtt kiszűr.
3. **Az AI soha nem dönt.** Csak javasol, és minden javaslat mögött ellenőrizhető idézet áll; a riportba csak szakértői jóváhagyással kerül bármi.

---

## 2. Kiindulópont: mi van már kész

| Kész (prototípus) | Hiányzik az éles, automatizált működéshez |
|---|---|
| Kockázati motor, forintosító képletek, indoklás-szövegek | Szerveres adatmentés, projektkezelés („Új projekt”), felhasználók |
| PDF-riport | Ügyfélportál, dokumentumfeltöltés, kérdőív |
| Interjúmodul (leirat, AI-elemzés, idézet-ellenőrzés) | **Dokumentumok automatikus feldolgozása** (szerződés, főkönyv) |
| Adatbázis-terv sorszintű jogosultságokkal, tesztekkel | Automatikus előjelölés kérdőívből és dokumentumokból |
| Bejelentkezés és API-védelem (kód) | Adatvédelmi dokumentáció, EU-s AI-feldolgozás, törlési automatizmus, biztonsági audit |

A prototípus kódja újrahasznosítható; a becslés ezzel már számol.

---

## 3. A cél-folyamat és az automatizálás mértéke

| Lépés | Ki / mi végzi | Automatizálás | Várható időmegtakarítás |
|---|---|---|---|
| 1. Projektnyitás, ügyfél meghívása | Projektvezető | Sablonból, egy kattintással | ~0,5 ó |
| 2. Kérdőív (30 kérdés) + dokumentumfeltöltés | Ügyfél | Hiánypótlás automatikus emlékeztetővel | ~1 ó (levelezés helyett) |
| 3. Dokumentum-feldolgozás | Rendszer | Szöveg- és táblázatkinyerés, szkennelt anyagnál karakterfelismerés | – |
| 4. Tények kinyerése (záradékok, kulcsszámok) | AI + szabályok | Javaslat oldal-hivatkozással | **~3–4 ó** |
| 5. Kockázatok előjelölése és forintosítása | Szabálymotor + AI | Előpipálás, képletek a főkönyvi adatokból | ~1 ó |
| 6. Interjúk (2–4 db) | Szakértő + AI | Célzott kérdéslista, leirat, ellentmondás-keresés | ~1–2 ó |
| 7. Ellenőrzés és jóváhagyás | **Szakértő** | Jóváhagyási sor: elfogad / módosít / elvet | – (ez marad a szakértői munka) |
| 8. Riport és workshop-anyag | Rendszer | PDF és diasor egy kattintással | ~2–3 ó |

---

## 4. Munkacsomagok és ráfordítás

Egy fejlesztői nap 8 óra. A „belső” tételek az ICT saját szakértőinek idejét jelentik (jog, adatvédelem, szakmai ellenőrzés).

| # | Munkacsomag | Tartalom | Nap (min–max) |
|---|---|---|---|
| WP0 | **Adatvédelmi és architektúra-tervezés** | Adattérkép, jogalapok, szerepkörök (adatkezelő / adatfeldolgozó), hatásvizsgálat (DPIA) első változata, szolgáltatóválasztás, EU-régiós AI-hozzáférés | 8–12 (ebből ~6–8 belső jogi/DPO) |
| WP1 | **Platform-alapok** | Projektkezelés („Új projekt”), szerveres mentés, céges Microsoft-belépés + kétlépcsős azonosítás, szerepkörök, audit napló, környezetek (fejlesztői / teszt / éles) | 15–20 |
| WP2 | **Ügyfélportál és kérdőív** | Meghívásos belépés, titkosított feltöltés kategóriákba, hiánypótlás, 30 kérdéses kérdőív, szabályalapú előpipálás | 18–25 |
| WP3 | **Dokumentum-feldolgozó lánc** | PDF / DOCX / XLSX / szkennelt kép, vírusellenőrzés, **személyes adatok kiszűrése az AI előtt**, darabolás, AI-kinyerés strukturáltan, oldal-hivatkozással, idézet-ellenőrzés, tények jóváhagyása | 25–35 |
| WP4 | **Főkönyv- és pénzügyi import** | A leggyakoribb 2–3 hazai könyvelőprogram exportja: árbevétel, fedezet, DSO, vevő- és szállítókoncentráció, kapcsolt ügyletek | 12–18 |
| WP5 | **Előjelölés és jóváhagyási sor** | A dokumentum-tények, kérdőív-válaszok és interjúk összevezetése katalógustételekre, bizonyossági szinttel; szakértői „beérkező” lista; szektorkatalógusok | 12–18 |
| WP6 | **Interjúmodul élesítése** | EU-s leiratkészítés, hozzájárulás / tájékoztatás rögzítése, a hang automatikus törlése, a már kész elemzés bekötése | 6–10 |
| WP7 | **Riport és workshop-diasor** | ICT-arculat, riport-verziók, partneri kiadás, vízjel, záró prezentáció generálása | 8–12 |
| WP8 | **Időkeret, beszámítás, leadek** | Óraszámfogyás, kreditnyilvántartás, lead átadása a divízióknak | 8–12 |
| WP9 | **Biztonság és megfelelés** | Titkosítás és kulcskezelés, mentés-visszaállítási teszt, megőrzés és automatikus törlés, érintetti kérelmek (kikérés, törlés) támogatása, incidens-riasztások; felkészülés a külső sérülékenységvizsgálatra | 12–18 |
| WP10 | **AI-minőségbiztosítás** | Kiértékelő készlet 20–30 anonimizált dokumentumon; pontosság és **kihagyási arány** mérése; automatikus ellenőrzés modellváltáskor | 10–15 |
| WP11 | **Pilot és bevezetés** | 2–3 éles projekt, betanítás, finomhangolás, mérés a kiinduló állapothoz képest | 10–15 |
| | Projektvezetés, tesztelés, dokumentáció (~12%) | | 17–25 |
| | **Összesen (teljes változat)** | | **161–235** |

**Karcsú változat (Microsoft 365-re építve):**
- WP2 helyett **Forms + SharePoint** és integráció: 6–9 nap;
- WP8 helyett export a meglévő CRM-be vagy Excelbe: 3–5 nap;
- WP7 a workshop-diasor nélkül: 5–8 nap.

**Összesen: 139–205 nap.** Hátránya: az ügyfélélmény kevésbé egységes, és a SharePoint-jogosultságokat külön kell fegyelmezetten kezelni.

---

## 5. Költségbecslés

### 5.1 Egyszeri költségek

| Tétel | Teljes | Karcsú | Megjegyzés |
|---|---|---|---|
| Fejlesztés (150 000 Ft/nap középár) | 24,2–35,3 M Ft | 20,9–30,8 M Ft | 120–180 ezer Ft/nap sávval: 19–42 M Ft, illetve 17–37 M Ft |
| Külső sérülékenységvizsgálat (pentest) | 2–4 M Ft | 2–4 M Ft | Élesítés előtt, majd évente |
| Külső adatvédelmi szakértő / DPO-támogatás | 1,5–3 M Ft | 1,5–3 M Ft | Elhagyható, ha az ICT Legal belsőleg végzi (~10–15 nap belső idő) |
| **Összesen** | **~28–42 M Ft** | **~24–38 M Ft** | |

### 5.2 Futó költségek (havi)

| Tétel | Becslés | Megjegyzés |
|---|---|---|
| Üzemeltetés (EU-s adatbázis, fájltár, mentések, teszt- és éles környezet) | 80–250 ezer Ft | A választott csomagtól függ |
| Naplózás, monitorozás, biztonsági eszközök | 20–50 ezer Ft | |
| AI-feldolgozás (Claude) | néhány ezer Ft / projekt | Kb. 300–600 ezer bemeneti token projektenként a jelenlegi Opus-szintű díjakkal; 60 projekt/év esetén is < 1 M Ft/év |
| Leiratkészítés (Azure, EU) | ~1–2 ezer Ft / projekt | 2–4 óra hanganyag |
| Karbantartás, modell- és könyvtárfrissítések | 300–600 ezer Ft | 2–4 fejlesztői nap/hó; ez a legnagyobb futó tétel |
| **Összesen** | **~0,4–0,9 M Ft/hó** | |

### 5.3 Megtérülés (illusztráció)

Feltételezés: projektenként ~7 óra megtakarítás, 20–30 ezer Ft/óra belső önköltséggel. Ez projektenként **140–210 ezer Ft**.

| Éves projektszám | Megtakarítás / év | Futó költség / év | Nettó / év |
|---|---|---|---|
| 40 | 5,6–8,4 M Ft | 5–11 M Ft | −5 és +3 M Ft között |
| 60 | 8,4–12,6 M Ft | 5–11 M Ft | −3 és +8 M Ft között |
| 100 | 14–21 M Ft | 5–11 M Ft | +3 és +16 M Ft között |

**Tanulság:** az óramegtakarítás önmagában csak nagyobb volumen mellett téríti meg a fejlesztést. A valódi üzleti érték három dologban van:
- **ugyanazzal a csapattal több projekt** vihető;
- a riport **egyenletes minősége**;
- a **keresztértékesítés**: a mintaesetekben projektenként 7–9 M Ft javítási pipeline keletkezik.

Ezért érdemes a pilot alatt a kiinduló óraszámot és a lead-konverziót is mérni.

---

## 6. Projekt- és működési kockázatok

| Kockázat | Valószínűség | Hatás | Kezelés |
|---|---|---|---|
| **Az AI kihagy egy fontos záradékot** (hamis „nincs probléma”) | Közepes | Magas | A kiértékelő készleten a *kihagyási arányt* mérjük, nem csak a pontosságot. A rendszer soha nem állítja, hogy valami „nincs”, csak azt, hogy „nem talált”. A kritikus szerződéstípusoknál a szakértő ellenőrzőlistát kap. |
| Az AI nem létező dolgot állít | Alacsony | Magas | Minden állításhoz szó szerinti idézet és oldalszám kell; az ellenőrizhetetlen tételt a rendszer kiszűri. Ez az interjúmodulban már működik. |
| Rossz minőségű, szkennelt dokumentumok | Magas | Közepes | Minőségjelzés a feltöltéskor; gyenge felismerésnél kézi feldolgozásra irányít. |
| Főkönyv-formátumok sokfélesége | Magas | Közepes | Indulás a 2–3 leggyakoribb programmal, egyedi leképezési sablonokkal; a többi kézi bevitellel. |
| A szakértők nem használják | Közepes | Magas | Pilot két nyitott szakértővel; jóváhagyási sor a hosszú űrlapok helyett; a kiinduló óraszám mérése. |
| Az AI-szolgáltató modellt vagy árat vált | Közepes | Közepes | Szolgáltató-független réteg, rögzített modellverzió, modellváltás előtt automatikus kiértékelés. |
| Hibás riport miatti szakmai felelősség | Alacsony | Magas | Kötelező szakértői jóváhagyás, módszertani korlátok a riportban, a felelősségbiztosítás felülvizsgálata. |
| Határidő- vagy költségtúllépés | Közepes | Közepes | Fázisonként rögzített hatókör, döntési pont minden fázis végén; a karcsú változat tartalékként. |
| A fejlesztő kiesése | Közepes | Közepes | Két fejlesztő, dokumentált kód, automatikus tesztek (már most 65). |
| Az EU AI Act és a jogszabályok változása | Közepes | Közepes | Lásd 7.3; félévente jogi felülvizsgálat. |

---

## 7. Adatvédelem: aggályok és megoldások

### 7.1 Milyen adatokat kezel a rendszer

| Adatkör | Példa | Érzékenység |
|---|---|---|
| Üzleti titok | Főkönyv, szerződések, árazás | Magas (nem személyes adat, de titoktartás, jogi részben ügyvédi titok) |
| **Munkavállalói személyes adatok** | Munkaszerződések, bérek, jogviszonyok | Magas |
| **Interjúk** | Hangfelvétel, leirat, vélemények | Magas (a hang és a vélemény is személyes adat) |
| **Kulcsember-értékelés** | Pótolhatóság, távozási kockázat | Nagyon magas (értékeléshez közeli) |
| Kapcsolattartók | Név, e-mail, telefon | Alacsony–közepes |
| Különleges adatok (nem célzottan) | Egészségügyi adat, szakszervezeti tagság egy HR-anyagban | Kiemelt; **nem kérjük be**, a rendszer felismeri és kitakarja |

**Szerepkörök:** az ügyfél munkavállalóinak adatait az ICT jellemzően az ügyfél megbízásából kezeli, tehát adatfeldolgozó. A saját felhasználóinak adatai tekintetében adatkezelő. A pontos minősítést és a jogi munkarész ügyvédi titokként kezelését **az ICT Legal döntse el** (WP0). Ettől függ a szerződések szerkezete.

### 7.2 Aggályok és megoldások

| # | Aggály | Megoldás | Megvalósítás |
|---|---|---|---|
| 1 | **Adat kerül az EU-n kívülre** (AI-, felhő- vagy leiratszolgáltató) | Minden feldolgozás EU-régióban: adatbázis és fájltár EU-ban, leirat az Azure EU-régiójában. **AI:** a Claude saját API-ja jelenleg csak „US” vagy „globális” feldolgozási földrajzot kínál, EU-t nem. Ezért a Claude-ot **EU-régiós felhőszolgáltatón (AWS Bedrock vagy Google Vertex AI EU-régió) keresztül** használjuk. Az adott modell EU-s elérhetőségét és a feltételeket beszerzés előtt ellenőrizni kell. Ahol a szolgáltató anyavállalata EU-n kívüli: szerződéses garanciák és továbbítási hatásvizsgálat. | Technikai + szerződés |
| 2 | Az AI-szolgáltató **tanul az adatokból** vagy megőrzi őket | Vállalati API-feltételek: az adatok nem kerülnek modellfejlesztésre, a megőrzés a lehető legrövidebb. Ezt **adatfeldolgozói szerződésben rögzítjük**, nem az általános feltételekre hagyatkozunk. | Szerződés |
| 3 | **Túl sok adat megy az AI-hoz** (adattakarékosság) | Kiszűrés **küldés előtt, EU-n belül**: nevek, adóazonosító, TAJ, bankszámlaszám, e-mail, telefon helyére álnév kerül (pl. „[MUNKAVÁLLALÓ-07]”). Bérlistából csak összesítés, szerződésből csak a releváns szakaszok. A visszafejtési kulcs sosem hagyja el a rendszert. | Technikai (WP3) |
| 4 | **Különleges adatok** a feltöltött anyagokban | Automatikus felismerés és kitakarás; a feltöltési felület és a tájékoztató kifejezetten kéri, hogy ilyet ne töltsenek fel; találat esetén figyelmeztetés a projektvezetőnek. | Technikai + folyamat |
| 5 | **Hangfelvétel** az interjúkon | Munkaviszonyban a hozzájárulás önkéntessége vitatható, ezért a jogalapot (jogos érdek vagy hozzájárulás) az ICT Legal választja meg, mérlegelési teszttel. Az interjúalany előzetes, írásos tájékoztatást kap; **mindig van felvétel nélküli lehetőség** (jegyzet). A hang a leirat ellenőrzése után **automatikusan törlődik** (pl. 72 óra), a leirat álnevesített. | Folyamat + technikai (részben kész) |
| 6 | **Kulcsember-értékelés** mint az egyén értékelése | A rendszer **szervezeti kockázatot** ír le, nem egyéni teljesítményt. Automatizált döntés nincs, a szakértő dönt. A személyeket álnév jelöli, az adatot csak a HR-szakértő és a partner látja (az adatbázisban kész és tesztelt). Az érintettek tájékoztatásához sablont adunk az ügyfélnek. | Technikai + folyamat |
| 7 | **Belső jogosulatlan hozzáférés** | Sorszintű jogosultság pillérenként (kész), céges belépés kétlépcsős azonosítással, legkisebb jogosultság elve, **minden megnyitás és letöltés naplózva**, rövid lejáratú letöltési linkek, negyedéves jogosultság-felülvizsgálat. | Technikai + folyamat |
| 8 | **Külső támadás, adatszivárgás** | Titkosítás tárolásban és átvitelben; kérésre ügyfelenkénti titkosítási kulcs; frissített függőségek; kérésszám-korlátozás; külső sérülékenységvizsgálat élesítés előtt és évente. | Technikai |
| 9 | **Dokumentumba rejtett utasítás** (az AI félrevezetése) | Az AI nem fér hozzá adatbázishoz, fájlokhoz vagy más eszközhöz: szöveget kap, és rögzített szerkezetű választ ad. A kimenetet ellenőrizzük; idézet nélküli állítás nem marad meg (az interjúmodulban kész). | Technikai |
| 10 | **Megőrzés és törlés** | Projektzárás után meghatározott idővel (pl. 6–12 hónap, a megbízási szerződés szerint) a dokumentumok, leiratok és kinyert tények **automatikusan törlődnek**; a riport-pillanatkép marad. A mentésekből is kifutnak; a törlés naplózott és igazolható. | Technikai + szabályzat |
| 11 | **Érintetti jogok** (kikérés, törlés, helyesbítés) | Projektenkénti keresés, export és törlés funkció; kérelemkezelési folyamat határidőkkel. | Technikai + folyamat |
| 12 | **Adatvédelmi incidens** | Riasztások (szokatlan letöltés, sikertelen belépések), incidenskezelési szabályzat felelősökkel, 72 órás bejelentési folyamat, gyakorlás évente. | Folyamat + technikai |
| 13 | **A riport kiszivárgása** | Partneri jóváhagyás a kiadáshoz, vízjel (címzett, dátum), a letöltés naplózva. | Technikai |
| 14 | **Valós adat fejlesztés vagy tesztelés közben** | Fejlesztésben és tesztben **csak kitalált adat** (mint a mostani mintaesetek). Az AI kiértékelő készlet csak anonimizált dokumentumokból áll, az ügyfél hozzájárulásával. | Folyamat |

### 7.3 EU AI Act

- A rendszer **javaslattevő eszköz**, a döntést ember hozza meg. Munkavállalókról nem hoz automatizált döntést, és nem értékeli a teljesítményüket. Így várhatóan nem minősül magas kockázatú MI-rendszernek. **A minősítést az ICT Legal végezze el** (a HR-modul és a kulcsember-értékelés miatt ez határeset lehet).
- Mindenképp teljesítendő:
  - **átláthatóság**: az ügyfél és az interjúalanyok tudják, hogy AI-t használunk, mire és milyen korlátokkal;
  - a felhasználók **AI-jártassága**: rövid belső képzés és AI-használati szabályzat.

### 7.4 Kötelező dokumentumok (a megfelelés igazolása)

- [ ] Adatkezelési nyilvántartás
- [ ] **Adatvédelmi hatásvizsgálat (DPIA)**: valószínűleg kötelező (munkavállalói adatok, új technológia, értékelés)
- [ ] Adatfeldolgozói szerződések: ügyfél ↔ ICT, illetve ICT ↔ minden alvállalkozó (felhő, AI, leirat)
- [ ] Továbbítási hatásvizsgálat, ahol EU-n kívüli anyavállalat érintett
- [ ] Adatkezelési tájékoztatók: az ügyfélnek, valamint az érintett munkavállalóknak és interjúalanyoknak
- [ ] Interjú-tájékoztató és a jogalap dokumentációja (jogos érdek esetén mérlegelési teszt)
- [ ] Adatmegőrzési és törlési szabályzat
- [ ] Hozzáférési mátrix és negyedéves felülvizsgálati napló
- [ ] Incidenskezelési szabályzat
- [ ] AI-használati szabályzat és képzési nyilvántartás
- [ ] Sérülékenységvizsgálati jelentés és a javítások igazolása

### 7.5 Mikor mondhatjuk, hogy „adatvédelmi szempontból kész”?

Az élesítés feltételei, mindegyik igazolható:

1. A 7.4 összes dokumentuma elkészült, és az adatvédelmi felelős jóváhagyta.
2. A hatásvizsgálat szerint **nem maradt magas maradványkockázat**. Ha maradna, a hatóság előzetes konzultációja szükséges, és addig nincs élesítés.
3. Minden adatfeldolgozó EU-ban dolgozik, és mindegyikkel van aláírt adatfeldolgozói szerződés.
4. A sérülékenységvizsgálatban **nincs nyitott magas vagy kritikus** tétel.
5. Az automatikus törlést és a mentés-visszaállítást egyszer ténylegesen kipróbáltuk, és jegyzőkönyveztük.
6. A kiszűrés (álnevesítés) működését mintán igazoltuk: az AI-hoz küldött szövegben nincs név és azonosító.
7. Évente felülvizsgálat, szolgáltató- vagy modellváltáskor soron kívül.

---

## 8. Ütemterv (2 fejlesztő + részidős adatvédelmi szakértő)

| Időszak | Fázis | Eredmény | Döntési pont |
|---|---|---|---|
| 1–2. hét | **F0 – Tervezés** | Adattérkép, jogalapok, hatásvizsgálat-tervezet, szolgáltatóválasztás, szerződések indítása | Szerepkörök és EU-s AI-hozzáférés jóváhagyva |
| 3–8. hét | **F1 – Alapok** | Projektkezelés, belépés, szerveres mentés, audit napló, feltöltés, dokumentum-feldolgozás alapja | Belső demó |
| 9–14. hét | **F2 – Automatizálás** | AI-kinyerés kiszűréssel, főkönyv-import, előjelölés, jóváhagyási sor, kiértékelő készlet | Mért pontosság és kihagyási arány elfogadható |
| 15–18. hét | **F3 – Ügyfél és megfelelés** | Portál és kérdőív (vagy M365), riport és diasor, törlési automatizmus, sérülékenységvizsgálat | Adatvédelmi „kész” feltételek (7.5) teljesülnek |
| 19–22. hét | **F4 – Pilot** | 2–3 éles projekt, mérés, javítások | Bevezetés minden projektre |

---

## 9. Javasolt döntések most

1. **Adatvédelmi szerepkör és jogalapok** (ICT Legal): adatfeldolgozó vagy adatkezelő; hogyan kezeljük az ügyvédi titkot; mi az interjúk jogalapja.
2. **EU-s AI-hozzáférés:** AWS Bedrock EU vagy Google Vertex AI EU. Az adott Claude-modell EU-régiós elérhetősége és a szerződési feltételek alapján.
3. **Teljes vagy karcsú változat:** saját ügyfélportál, vagy Microsoft 365-re építés.
4. **Pilot:** mely 2–3 projekt, és melyik szenior jogász és adószakértő vesz részt.
5. **Kiinduló mérés most:** mennyi ma egy projekt óraszáma, ebből mennyi a dokumentum-átnézés és a riportírás.

---

## 10. Feltételezések és ami nincs benne

- **Díjak:** fejlesztés 150 000 Ft/nap középárral (120–180 ezer Ft sáv); a belső ICT-időt nem árazzuk be, csak napban jelöljük.
- **Nincs benne:** ISO 27001 tanúsítás (a rendszer felkészíthető rá, külön projekt); más könyvelőprogramok importja a 2–3 leggyakoribbon túl; mobilalkalmazás; más nyelvek.
- **AI-díjak:** a jelenlegi Opus-szintű listaárakkal számolva; EU-régiós felhőszolgáltatónál a díj eltérhet, beszerzéskor ellenőrizendő.
- A becslés a meglévő prototípus újrahasznosításával számol.
