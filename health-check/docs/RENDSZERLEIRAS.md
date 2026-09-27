# ICT Health Check – Rendszerleírás

> **Kinek szól:** szolgáltatástervezőnek, vezetőknek, a pilotban részt vevő szakértőknek, illetve AI-asszisztensnek, amely a szolgáltatást tovább tervezi.
>
> **Állapotjelölés:** ✅ működő prototípus · 🟡 adatmodell kész, felület még nincs · ⬜ terv
>
> **Kipróbálható előnézet:** https://claude.ai/artifact/Uh5Ecjs1vwfYQvZpEBnVh2 (kitalált mintaadatokkal)

---

## 1. Összefoglaló

Az **ICT Európa** (jog, adó, könyvelés, HR) standardizált, gyors vállalati átvilágítást kínál magyar középvállalatoknak. A belső szoftver célja, hogy egy átvilágítás **18–21 szakértői órából** kijöjjön, és az eredmény egy döntéshozóknak szóló, **forintosított Red Flag riport** és egy **90 napos akcióterv** legyen. A feltárt hibák az ICT divíziói felé **javítási megbízásként** továbbmennek, a belépő díj (1,2 M Ft) pedig **100%-ban beszámít** ezekbe.

Alapelv: **a gép előkészít és számol, a szakértő dönt.** Minden AI-javaslat mögött szó szerinti, ellenőrizhető bizonyíték áll, és csak szakértői jóváhagyással kerül a riportba.

---

## 2. Hogyan készül a diagnosztika? Kézzel vagy feltöltött adatokból?

**Röviden: ma félautomata.** A számolás teljesen automatikus: pontozás, forintosítás, akcióterv, ajánlat és PDF-riport. A bemenet nagy részéről azonban még a szakértő dönt. Az interjúkat már AI dolgozza fel, a feltöltött dokumentumok automatikus elemzése viszont még nincs kész.

| # | Adatforrás | Ki adja | Hogyan kerül a rendszerbe | Állapot |
|---|---|---|---|---|
| 1 | **Kockázati katalógus** (16 alaptétel + szektorspecifikus tételek) | ICT módszertan | Előre betöltve, indoklással és javaslattal | ✅ |
| 2 | **Szakértői értékelés** (fennáll-e, valószínűség, hatás) | Pillér-szakértő | Kézzel: pipálás és két legördülő menü soronként | ✅ |
| 3 | **Cégadatok** (árbevétel, fedezet, DSO) | Szakértő a főkönyvből | Kézzel a projekt fejlécébe; ebből számolnak a forintosító képletek | ✅ (automatikus kinyerés a főkönyvből ⬜) |
| 4 | **Vezetői interjúk** | Szakértő + interjúalany | Hangfájl → leirat, vagy beillesztett jegyzet → **AI-elemzés** → javasolt kockázatok és ellentmondások → a szakértő egy kattintással elfogadja | ✅ (élesben API-kulcs kell) |
| 5 | **Feltöltött dokumentumok** (szerződések, főkönyv, cégkivonat) | Ügyfél | **AI-előszűrés** → „ismert tények” (pl. Change of Control záradék, hiányzó jogátruházás) és előjelölt kockázatok | ⬜ Most a tényeket a szakértő rögzíti kézzel; a mintaesetekben előre kitöltött példák vannak |
| 6 | **Ügyfél-kérdőív** (30 pont) | Ügyfél | Válaszok → szabályalapú előjelölés (pl. „nincs transzferár-nyilvántartás” → transzferár-kockázat) | 🟡 Kezdetben MS Forms is megfelel |

**Cél-állapot:** az ügyfél feltölt és kitölt, a gép az 5–6. forrásból előjelöl, az interjúk az ellentmondásokat mutatják meg, a szakértő pedig csak ellenőriz, pontosít és jóváhagy. A mostani prototípusban a 4. forrás (interjú) már így működik, az 5–6. még nem.

```
             MA                                          CÉL
 szakértő pipál + becsül  ──┐              ügyfél-kérdőív ─┐
 cégadatok kézzel ──────────┤              dokumentumok ───┼─► AI/szabály előjelöl
 interjú ─► AI-javaslat ────┤              interjú ────────┘         │
                            ▼                                        ▼
                  automatikus: pontozás, forintosítás,     szakértő: ellenőriz, jóváhagy
                  akcióterv, ajánlat, PDF-riport                     │
                                                                     ▼
                                                           automatikus riport
```

---

## 3. Üzleti modell

| Elem | Érték |
|---|---|
| Célcsoport | Magyar KKV-k, 1–5 Mrd Ft éves árbevétel |
| Belépő termék | Expressz audit, **1,2 M Ft + ÁFA** |
| Átfutás | 10 munkanap (expressz) / 4 hét (standard) |
| Erőforráskeret | **18–21 szakértői óra / projekt** |
| Fő kimenet | Vezetői Red Flag riport (PDF) + 90 napos akcióterv |
| Bevételi logika | A belépő díj **100%-ban beszámít** a javítási megbízásokba |
| Keresztértékesítés | ICT Legal, ICT Adó, ICT Könyvelés, ICT HR, ICT Advisory |

---

## 4. Átvilágítás-típusok ✅

Ugyanaz a motor szolgál ki minden típust; a típus a hangsúlyokat, a kötelező interjúkérdéseket, az óraszámkeretet és a riport címzettjét állítja.

**Mit változtat a típus (✅):**
- **Tételenkénti korrekció:** ugyanannak a ténynek a vizsgálat céljától függően más a súlya. A Change of Control záradék például Health Checknél V−1, eladásnál V+2, mert a tranzakció kiváltja. A korrekció megváltoztatja a besorolást, a várható veszteséget, az akcióterv sorrendjét és az ajánlatot. Tételenként kikapcsolható; a táblázat kezdő javaslat, a szakértők jóváhagyására vár.
- **Pillérsúlyok** az összesített Health Score-ban, és ebből az **óraszámkeret pillérenkénti bontása**.
- **Fókusztételek** a lista elején, és **típusonként 2 saját kockázati tétel**, egy kattintással felvehetően.
- **Riport-nézőpont:** a címlap és az ajánlat a címzett szemszögéből fogalmaz.
- **Interjúterv:** kivel, milyen sorrendben, meddig, miért és miről beszéljünk. A kérdések címzetthez kötöttek, és minden interjú a tervhez van rendelve, állapottal.

Példa: ugyanaz a gyártó mintacég, változatlan válaszokkal. Health Checkként 52 pont, 3 piros tétel, 182 M Ft várható veszteség (a Change of Control V2 × H5, 46 M Ft várható veszteséggel sárga); vendor DD-ként 37 pont, 5 piros tétel, 343 M Ft (a CoC V5 × H5, piros).

| Típus | Kinek szól | Fókusz | Keret |
|---|---|---|---|
| Vállalati Health Check | tulajdonos / vezetés | általános állapot, 90 napos terv | 18 ó |
| Vendor DD (eladói) | eladó és potenciális vevők | eladás előtti értékvédelem | 21 ó |
| Buy-side DD (vevői) | vevő / befektető | árazás, garanciák | 21 ó |
| Finanszírozási felkészültség | bank / befektető | cash-flow, kovenánsok | 18 ó |
| Generációváltás / utódlás | alapító család | kulcsember, tulajdonosi struktúra | 20 ó |
| Megfelelőségi audit | vezetés / FB | adó, munkajog, GDPR, engedélyek | 19 ó |
| Akvizíció utáni integráció | új tulajdonos | első 100 nap | 20 ó |

---

## 5. Szereplők és jogosultságok ✅

| Szerep | Mit lát / csinál |
|---|---|
| **Ügyfél** | Feltölt, kitölt, látja a státuszt és a partner által kiadott riportot. Nyers kockázatot, interjút és más ügyfelet nem lát. |
| **Szakértő** (pillérenként) | Csak a saját pillére dokumentumait és munkalapját kezeli; az összesített kockázati képet olvassa. |
| **HR-szakértő** | Ő és a partner látja a bizalmas kulcsember-interjúkat. |
| **Manager** | A saját projektjeinek teljes nézete. |
| **Partner** | Mindent lát; riportot ad ki, szakértői paramétert hagy jóvá, kezeli a kreditet. |

A jogosultságokat az adatbázis érvényesíti sorszintű szabályokkal, ezt tesztek ellenőrzik. Az AI-funkciókat csak bejelentkezett belső felhasználó érheti el; beállítás nélkül zárva vannak.

---

## 6. Modulok és állapotuk

| Modul | Tartalom | Állapot |
|---|---|---|
| **Red Flag mátrix** | Pipálás, 1–5 skálás pontozás, közlekedési lámpa, 5×5 mátrix, pillér-egészségpontszám | ✅ |
| **Forintosítás** | Képletek a cégadatokból (árbevétel-arány, darab × tételösszeg, DSO-különbség), tételenkénti szakértői felülírás, jóváhagyandó szakértői paraméterek | ✅ |
| **Szakmai indoklás** | Minden tételhez előre megírt, szerkeszthető szöveg, ami a riportba kerül | ✅ |
| **90 napos akcióterv** | Automatikus besorolás: gyors javítás / kritikus / strukturális | ✅ |
| **Ajánlat és beszámítás** | Pipeline divíziónként, 1,2 M Ft kredit, nettó összeg | ✅ számítás · 🟡 CRM-folyamat |
| **PDF-riport** | Egy kattintás: vezetői összefoglaló, scorecard, részletező, akcióterv, ajánlat, módszertan | ✅ · záró workshop diasora ⬜ |
| **Interjúmodul** | Célzott kérdéslista, hang/jegyzet → leirat, AI-elemzés, ellentmondás-keresés, átvétel a mátrixba | ✅ |
| **Dokumentum AI-előszűrés** | Szerződésekből záradékok, főkönyvből kulcsszámok, oldal-hivatkozással | ⬜ |
| **Ügyfélportál / kérdőív** | 30 pontos kérdőív, dokumentumfeltöltés, hiánypótlás | 🟡 (MS Forms / SharePoint javasolt induláshoz) |
| **Időkeret-követés** | Óraszámfogyás pillérenként, fedezet | 🟡 |
| **Bejelentkezés** | Céges Microsoft-fiók vagy meghívásos e-mail link | ✅ kód · élesítéshez Supabase-projekt kell |
| **Adatmentés szerverre** | Projektek, kockázatok mentése adatbázisba | 🟡 (a prototípus a böngészőben tárol) |

---

## 7. Kockázati motor és forintosítás szabályai ✅

| Szabály | Érték |
|---|---|
| Pontszám | valószínűség (1–5) × hatás (1–5) |
| Besorolás | ≥ 15 piros · 8–14 sárga · < 8 zöld |
| Lényegességi küszöb | ha a **várható veszteség** (kitettség × valószínűség) eléri, a tétel mindig piros; egy nagy, de valószínűtlen kitettség így nem piros automatikusan (projektenként állítható) |
| Valószínűség → esély | 5% · 20% · 40% · 65% · 90% |
| Várható veszteség | bruttó kitettség × esély |
| Gyors javítás | nem zöld és ≤ 5 munkanap → 0–30 nap |
| Akcióterv | gyors javítás 0–30 · piros 31–60 · sárga 61–90 · zöld figyelés |
| Keresztértékesítés | csak sárga és piros tételből |
| Beszámítás | kredit = min(audit díj, javasolt díjak) |

**Forintosító képletek** (mindegyik kiinduló becslés, tételenként felülírható):

| Képlet | Számítás | Példa |
|---|---|---|
| Árbevétel-arány | árbevétel × arány (× fedezeti hányad, ha bekapcsolt) | Change of Control, kulcsember, megrendelő-függés |
| Darab × tételösszeg | darabszám × egységösszeg | transzferár-nyilvántartás hiánya |
| DSO-különbség | árbevétel / 365 × (tényleges − iparági DSO) | lejárt vevőállomány |
| Kézi | a szakértő írja be | minden egyéb |

**Korlátok, amelyeket a szakértőknek érdemes tudniuk:**
- Jogszabályi összeget (bírságplafont) szándékosan nem építettünk be. Az egységösszegek szakértői paraméterek; amíg a felelős divízió nem hagyja jóvá őket, a riport „TERVEZET” jelölést kap.
- Az árbevétel-arány alapból az **elmaradó fedezettel** számol, nem a teljes árbevétellel. Hogy melyik a helyes alap, azt a pénzügyi szakértők döntik el.
- A DSO-képlet **lekötött forgótőkét** mér, nem veszteséget; a motor azonban ugyanúgy valószínűséggel szorozza. Ezt a módszertanban tisztázni kell.

---

## 8. A riport (PDF) ✅

1. **Címlap és vezetői összefoglaló:** összesített minősítés, bruttó és várható kitettség, a három legfontosabb megállapítás.
2. **Pillér-scorecard és kockázati mátrix.**
3. **Red Flag részletező:** indoklás, bizonyíték, forint-levezetés, javasolt intézkedés, felelős divízió.
4. **90 napos akcióterv** időablakonként.
5. **Ajánlat, beszámítás és módszertan.**

A riport a böngészőben készül, az adatok nem hagyják el a gépet. Az arculat (logó, színek) még helykitöltő.

---

## 9. AI-használati elvek

1. **Az AI javasol, a szakértő dönt.** Semmi nem kerül riportba emberi jóváhagyás nélkül.
2. **Bizonyíték nélkül nincs állítás.** Minden AI-tételhez szó szerinti idézet kell a leiratból; ha az idézet nem található, a rendszer automatikusan kiszűri.
3. **Ellentmondás csak dokumentált tényhez képest** jelezhető, forrásmegjelöléssel.
4. **A feltöltött tartalom adat, nem utasítás.**
5. **Adatvédelem:** hozzájárulás nélkül nincs hangfeldolgozás, a hangot nem tároljuk, a kulcsembereket álnév jelöli, a bizalmas interjúkat csak a HR-szakértő és a partner látja.
6. **AI nélkül is működik:** a kérdéslista, a pontozás, a forintosítás és a riport kulcs nélkül is elkészül.

---

## 10. Mintaesetek (kitalált cégek) ✅

A prototípusban négy mintaeset választható („Minta:” menü a mátrix és az interjú oldalon). Mindegyik tartalmaz:
- cégadatokat és azonosított kockázatokat, köztük szektorspecifikus tételeket, indoklással;
- dokumentumokból „ismert” tényeket és hiányzó dokumentumokat;
- egy vezetői interjút és hozzá egy előre elkészített elemzést, benne ellentmondásokkal.

| Mintaeset | Típus | Helyzet | Eredmény |
|---|---|---|---|
| **Példa Építőipari Kft.** (3,8 Mrd Ft) | Finanszírozási felkészültség | Bankgarancia-keret bővítése előtt | Piros · 46/100 · 9 tétel · bruttó ~1 Mrd Ft · várható 557 M Ft |
| **Példa Könyvelő Iroda Kft.** (1,2 Mrd Ft) | Generációváltás | Az alapító 3 éven belül visszavonulna | Piros · 44/100 · 11 tétel · bruttó 396 M Ft · várható 207 M Ft |
| **Példa Szoftverház Kft.** (2,1 Mrd Ft) | Vendor DD | Befektetőbevonás 18 hónapon belül | Piros · 45/100 · 11 tétel · bruttó 1,1 Mrd Ft · várható 500 M Ft |
| Minta Gyártó Kft. (2,4 Mrd Ft) | Vendor DD | Általános minta | Piros · 50/100 · 7 tétel · bruttó 529 M Ft |

**Az interjúkban feltárt ellentmondások:**

- **Építőipar**
  - Az ügyvezető szerint a legnagyobb megrendelő „a munkák legfeljebb ötödét” adja, a főkönyv szerint 45%-ot.
  - Az ügyvezető szerint „a kötbér mindig maximálva van”, két futó szerződésben viszont nincs kötbérplafon, és az egyik projekt már csúszik.
  - További javaslat: a brigádok napi beosztása munkaviszony jellegre utal (színlelt vállalkozói jogviszony).
- **Könyvelőiroda**
  - Az alapító szerint „az inflációs díjemelés benne van a szerződésekben”, a szerződések 70%-ában viszont nincs indexálási záradék.
  - A mentés visszaállítását tavalyinak mondja, a napló szerint 2023-as.
  - Az üzletrészek megosztásáról nincs megállapodás, és a régi ügyfelek az alapítóhoz kötődnek.
- **IT-fejlesztő**
  - Az ügyvezető szerint „a kód a mi GitLabunkon van, tehát a miénk”, 9 fejlesztő szerződéséből viszont hiányzik a jogátruházás.
  - Szerinte „csak MIT és Apache” licencet használnak, a szkenner 3 GPL komponenst talált.
  - Szerinte a legnagyobb ügyfél „nem tud kilépni”, a szerződés tulajdonosváltáskor azonnali felmondást enged.

---

## 11. Technológia és biztonság

- **Alkalmazás:** Next.js (React), Tailwind; magyar felület, mobilon is használható.
- **Adatbázis és bejelentkezés:** Supabase (PostgreSQL, EU régió), sorszintű jogosultságkezelés, audit napló; belépés céges Microsoft-fiókkal vagy meghívásos e-mail linkkel.
- **AI:** Claude API (interjúelemzés, kérdésjavaslat), Azure AI Speech (magyar leirat); mindkettő csak a szerveren, bejelentkezés után érhető el.
- **Riport:** böngészőben generált PDF (react-pdf, Inter betűkészlet).
- **Tesztek:** 65 automatikus teszt (számítás, idézet-ellenőrzés, PDF-generálás, jogosultság, mintaesetek) és adatbázis-jogosultsági tesztek.

---

## 12. Ami kipróbálható az előnézetben

- Mintaeset kiválasztása (építőipar, könyvelő, IT, gyártó).
- **Red Flag mátrix:**
  - cégadatok módosítása, amire a forintösszegek azonnal újraszámolódnak;
  - sor lenyitása: indoklás, képlet és felülírás;
  - akcióterv, ajánlat és beszámítás;
  - **PDF-riport** mentése.
- **Interjúk:**
  - kérdéslista szerepkör és típus szerint;
  - „Minta interjú betöltése”, majd „Minta-elemzés megtekintése”: ellentmondások, javaslatok;
  - javaslat elfogadása, ami „AI · interjú” jelöléssel megjelenik a mátrixban.
- **Nem elérhető az előnézetben:** az élő AI-elemzés és a hangfeldolgozás, mert szerver és kulcsok kellenek hozzá, és a szerveres mentés. A módosítások csak a néző böngészőjében maradnak meg.

---

## 13. Nyitott kérdések

**Módszertan (szakértői döntés)**
1. A Change of Control és a kulcsember-kockázat alapja az elmaradó fedezet vagy a teljes árbevétel legyen?
2. A transzferár-tételösszeg jóváhagyása (ICT Adó).
3. A DSO-alapú lekötött forgótőke kitettségként vagy külön „likviditási hatásként” szerepeljen a riportban?
4. Kell-e szektoronként saját katalógus (építőipar, szolgáltatás, IT), vagy elég az alapkatalógus és néhány szektortétel?

**Termék és folyamat**
5. Egy ár mind a 7 átvilágítás-típusra, vagy típusonként külön csomag?
6. Mennyi ideig érvényes az 1,2 M Ft-os kredit, és minden divízióba beszámít-e?
7. Ki készíti az interjúkat, és hány fér bele a keretbe (javaslat: 2–4 × 45–60 perc)?
8. Mit lát az ügyfél a folyamat közben, és van-e záró prezentáció?

**Bevezetés**
9. Pilot: melyik 2–3 éles projekt, melyik szenior jogász és adószakértő vesz részt?
10. Mérés: mennyi ma egy projekt óraszáma és a riportírás ideje? Ez a megtakarítás bizonyításának alapja.
11. Ki üzemelteti a rendszert, és ki hagyja jóvá az AI-szolgáltatók adatfeldolgozói szerződéseit?

---

*Utolsó frissítés: 2026. szeptember. Forráskód: `health-check/`; részletes műszaki leírás: `docs/` mappa.*
