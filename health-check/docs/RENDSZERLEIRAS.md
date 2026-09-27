# ICT Health Check – Rendszerleírás

> **Kinek szól:** szolgáltatástervező (ember vagy AI-asszisztens). A dokumentum leírja a szolgáltatás üzleti logikáját, a támogató szoftver működését, és jelöli, mi készült el és mi van még csak tervben. A végén a szolgáltatástervezéshez nyitott kérdések szerepelnek.
>
> **Állapotjelölés:** ✅ elkészült (működő prototípus) · 🟡 adatmodell kész, felület nincs · ⬜ terv

---

## 1. Összefoglaló

Az **ICT Európa** (jog, adó, könyvelés, HR tanácsadó cégcsoport) standardizált, gyors vállalati átvilágítást kínál magyar középvállalatoknak. A belső szoftver célja, hogy egy átvilágítás **18–21 szakértői órából** kijöjjön, és az eredmény egy döntéshozóknak szóló **Red Flag riport**, valamint egy **90 napos akcióterv** legyen. A feltárt problémák az ICT divíziói felé **értékesítési leadként** továbbmennek, a belépő díj pedig **100%-ban beszámít** a javítási munkákba.

A szoftver négy dolgot csinál:
1. **Adatot gyűjt** az ügyféltől: csekklista, dokumentumok, interjúk.
2. **Előfeldolgoz** AI-val: kérdésjavaslatok, leiratok, ellentmondás-keresés.
3. **Pontoz és forintosít** szabályalapú kockázati motorral.
4. **Továbbvezet** az akciótervbe, a keresztértékesítésbe és a kreditbeszámításba.

Alapelv: **az AI javasol, a szakértő dönt.** Minden AI-állítás mögött ellenőrizhető bizonyíték (szó szerinti idézet) van.

---

## 2. Üzleti modell

| Elem | Érték |
|---|---|
| Célcsoport | Magyar KKV-k, 1–5 Mrd Ft éves árbevétel |
| Belépő termék | Expressz audit, **1,2 M Ft + ÁFA** |
| Átfutás | 10 munkanap (expressz) / 4 hét (standard) |
| Erőforráskeret | **18–21 szakértői óra / projekt**, pillérenként bontva (pl. Pénzügy 7, Jog 6, Operáció 3, HR 3, projektvezetés 2) |
| Vizsgált pillérek | Pénzügy/Adó, Jog, Operáció, HR |
| Fő kimenet | 5 oldalas vezetői Red Flag összefoglaló + 90 napos prioritási akcióterv |
| Bevételi logika | A belépő díj **100%-ban beszámít** a javítási (remediation) megbízásokba → keresztértékesítés |
| Keresztértékesítés célja | ICT Legal (szerződés-átírás, IP), ICT Adó (transzferár), ICT Könyvelés (könyvelés-átvétel), ICT HR (BVKK, jogviszony-rendezés), ICT Advisory (beszállítói, operációs) |

### Egységgazdaságtan
- A projekt fedezete: `díj − Σ(ledolgozott óra × szakértői önköltség)`. A szoftver valós időben mutatja pillérenként a keret fogyását (80% felett figyelmeztet, 100% felett jóváhagyás kell).
- A szolgáltatás sikere azon múlik, hogy a szoftver kiváltja-e a kézi munkát: szerződés-átolvasás, interjújegyzetelés, riportírás.

---

## 3. Átvilágítás-típusok ✅

Ugyanaz a motor szolgál ki minden típust. A típus a hangsúlyokat, a kötelező kérdéseket, az óraszámkeretet és a riport címzettjét állítja be.

| Típus | Kinek szól | Fókusz | Keret |
|---|---|---|---|
| Vállalati Health Check | tulajdonos / vezetés | általános állapot, 90 napos javítási terv | 18 ó |
| Vendor Due Diligence (eladói) | eladó és potenciális vevők | eladás előtti értékvédelem | 21 ó |
| Buy-side Due Diligence (vevői) | vevő / befektető | árazás, garanciák, kártalanítás | 21 ó |
| Finanszírozási felkészültség | bank / tőkebefektető | cash-flow minősége, kovenánsok | 18 ó |
| Generációváltás / utódlás | alapító család | kulcsember-függőség, tulajdonosi struktúra | 20 ó |
| Megfelelőségi audit | vezetés / felügyelőbizottság | adó, munkajog, GDPR, engedélyek | 19 ó |
| Akvizíció utáni integráció | új tulajdonos | első 100 nap, kulcsemberek megtartása | 20 ó |

---

## 4. Szereplők és jogosultságok

| Szerep | Mit lát / csinál |
|---|---|
| **Ügyfél** (CFO, ügyvezető) | Kitölti a csekklistát, feltölti a dokumentumokat, látja a státuszt és a partner által kiadott riportot. Más ügyfél adatait és a nyers kockázatokat nem látja. |
| **Szakértő** (pillérenként: pénzügy, jog, operáció, HR) | Csak a saját pillére dokumentumait és munkalapját kezeli. Az összesített kockázati képet olvassa, de csak a saját pillérébe írhat. |
| **HR-szakértő** | Kizárólag ő (és a partner) látja a bizalmas kulcsember-interjúkat (HR 361). |
| **Projektmenedzser / manager** | A saját projektjeinek teljes nézete, időkeret-kezelés. |
| **Partner** | Mindent lát, riportot hagy jóvá és ad ki az ügyfélnek, kezeli a kreditet és a pipeline-t. |

A jogosultságokat az adatbázis érvényesíti sorszintű jogosultságkezeléssel (Row Level Security), ami az ügyvédi titoktartás miatt fontos. Ezt tesztekkel ellenőriztük.

---

## 5. A szolgáltatás folyamata (end-to-end)

```
 1. ONBOARDING      Megbízás, típus kiválasztása, csapat kijelölése, ügyfél-hozzáférés
        │
 2. ADATBEKÉRÉS     Ügyfélportál: 30 pontos csekklista + strukturált dokumentumfeltöltés
        │           (főkönyv, top 5 szerződés, cégkivonat, SZMSZ, munkaügyi anyagok)
        │           Automatikus hiánypótlási emlékeztetők (pl. 2., 5., 8. nap)
        │
 3. AI-ELŐSZŰRÉS    Dokumentumokból „ismert tények” (pl. Change of Control záradék,
        │           hiányzó IP-átruházás) → előjelölt kockázatok
        │
 4. INTERJÚK        Szerepkörönként generált kérdéslista → interjú (hang vagy jegyzet)
        │           → leirat → AI-elemzés: állítások, javasolt kockázatok,
        │           ELLENTMONDÁSOK a dokumentumokkal
        │
 5. SZAKÉRTŐI       Pillérenkénti munkalapok (EBITDA-normalizálás, transzferár,
    MUNKALAPOK      szerződések, beszállítói koncentráció, kulcsember-mátrix)
        │
 6. KOCKÁZATI       Red Flag mátrix: pipálás, pontozás, forintosítás →
    MOTOR           összkockázat, egészségpontszám, 90 napos akcióterv
        │
 7. RIPORT          Partneri jóváhagyás → 5 oldalas PDF + vezetői dashboard
        │
 8. REMEDIATION     Feltárt hibák → feladatok + leadek az ICT divízióknak
    & CRM           → kreditbeszámítás (1,2 M Ft) nyilvántartása
```

---

## 6. Modulok és állapotuk

### M1 · Ügyfélportál és digitális adatbekérő 🟡
- 30 pontos cégdiagnosztikai csekklista. Minden kérdéshez szabály köthető: például a „nincs transzferár-nyilvántartás” válasz automatikusan előjelöli a transzferár-kockázatot. *Az adatmodell kész; a 30 kérdés szövege és a felület még nincs meg.*
- Titkosított, strukturált dokumentumtár (VDR light): kategóriák, hiánypótlási lista, státusz, elfogadás vagy elutasítás.
- Automatikus emlékeztetők, amelyek egy idő után a projektmenedzsernek is feladatot generálnak.

### M2 · Szakterületi munkalapok 🟡
- **Pénzügy / Adó:** normalizált EBITDA-kalkulátor (tulajdonosi költségek, egyszeri tételek, kapcsolt ügyletek), transzferár-kockázat szűrő.
- **Jog:** Change of Control, IP-átruházás, munkajogi ellenőrzőlista.
- **Operáció:** beszállítói koncentráció, technológiai adósság pontozása.
- **HR:** HR 361 kulcsember-függőségi értékelés, álnévvel kezelt személyekkel.

### M3 · Kockázati motor és Red Flag riport ✅ (motor és felület) / ⬜ (PDF)
- 16 tételes alapkatalógus (4 pillér × 4 tétel), és egyedi tétel is felvehető.
- A szakértő bepipálja a fennálló kockázatokat, és megadja:
  - a valószínűséget és a hatást (1–5),
  - a forintosított kitettséget,
  - a javítás munkanapjait,
  - a felelős ICT divíziót és a becsült díjat.
- **Azonnali számítás:** besorolás közlekedési lámpa szerint (zöld / sárga / piros), bruttó kitettség, várható veszteség, egészségpontszám pillérenként, kattintható 5×5-ös mátrix, 90 napos akcióterv, keresztértékesítési pipeline, kreditbeszámítás.
- A PDF-export (5 oldal) még terv; most nyomtatás és JSON-export működik.

### M4 · Egységgazdaságtan és időrögzítés 🟡
- Óraszámkeret pillérenként, időrögzítés, keretfogyás és fedezet számítása (adatbázis-nézetekkel, tesztelve).
- A felület még hiányzik: fejlécben futó időmérő és partneri dashboard.

### M5 · Remediation és keresztértékesítés (CRM) 🟡
- Kockázat → javítási feladat (határidő, felelős, státusz) → lead a divízió felé.
- Leadek szakaszai: új, minősített, ajánlat, megnyert, elvesztett.
- A kreditnyilvántartásba csak új tétel írható, meglévő nem módosítható és nem törölhető; az egyenleg nem mehet negatívba.

### M6 · Interjúmodul ✅
- **Kérdésgenerálás** (AI nélkül is működik), a következőkből:
  - azonosított kockázatok,
  - hiányzó dokumentumok,
  - dokumentumokból ismert tények (ezeket meg kell erősíttetni),
  - az interjúalany szerepköre (ügyvezető, CFO, HR-vezető, operációs, értékesítési, IT-vezető, kulcsember),
  - az átvilágítás típusa.

  Minden kérdés prioritást kap (kötelező / ha van idő), indoklást („miért kérdezzük”) és „mire figyelj” tippet; a program időbecslést is ad. Opcionális AI-bővítés: legfeljebb 6 további célzott kérdés.
- **Leirat:**
  - hangfájlból magyar nyelvű leirat, a beszélők szétválasztásával;
  - vagy beillesztett / diktált jegyzet.

  Hangfeldolgozás csak az interjúalany hozzájárulásával indulhat. A hangot nem tároljuk.
- **AI-elemzés:**
  - összefoglaló és kulcsállítások pillérenként;
  - javasolt kockázatok;
  - **ellentmondások a dokumentumokkal**, súlyossággal. Példa: „A szerződés nem mondható fel” – a szerződés 11.3 pontja szerint viszont tulajdonosváltáskor 30 napon belül felmondható;
  - tisztázandó kérdések.
- **Bizonyíték-elv:** minden AI-tétel mögött szó szerinti idézet áll. Amit a leirat nem támaszt alá, azt a rendszer automatikusan kiszűri.
- **Emberi döntés:** az elfogadott javaslat „AI · interjú” jelöléssel és idézettel kerül a kockázati mátrixba, a súlyosságot sosem csökkenti.

### M7 · Dokumentum AI-előszűrés ⬜
- A feltöltött szerződésekből kigyűjti a Change of Control-, IP-átruházási, versenytilalmi, felmondási és kötbérpontokat, oldal- és bekezdés-hivatkozással. Ezekből lesznek az interjúmodul „ismert tényei”, így a junior jogásznak nem kell a teljes 40 oldalt átolvasnia.

---

## 7. Kockázati motor szabályai ✅

| Szabály | Érték |
|---|---|
| Pontszám | valószínűség (1–5) × hatás (1–5) = 1–25 |
| Besorolás | ≥ 15 piros · 8–14 sárga · < 8 zöld |
| Lényegességi küszöb | ha a kitettség eléri (alapból 50 M Ft, állítható), a tétel mindig piros |
| Valószínűség → esély | 1 → 5% · 2 → 20% · 3 → 40% · 4 → 65% · 5 → 90% |
| Várható veszteség | bruttó kitettség × esély |
| Quick win | nem zöld tétel, legfeljebb 5 munkanap alatt javítható |
| 90 napos akcióterv | quick win → 0–30 nap · piros → 31–60 nap · sárga → 61–90 nap · zöld → figyelés |
| Egészségpontszám | 0–100, pillérenként; egy súlyos tétel többet ront, mint sok apró |
| Összesített státusz | a legrosszabb pillér színe |
| Keresztértékesítés | csak sárga és piros tételből lesz lead |
| Kreditbeszámítás | kredit = min(audit díj, javasolt javítási díjak); nettó = díjak − kredit |

**Demó eredmény** (kitalált cég, 7 azonosított tétel):

| Mutató | Érték |
|---|---|
| Összesített státusz | piros |
| Egészségpontszám | 50/100 |
| Bruttó kitettség | 301 M Ft |
| Várható veszteség | 136 M Ft |
| Javasolt javítási munkák | 7,45 M Ft |
| Kredit | −1,2 M Ft |
| Nettó ajánlat | 6,25 M Ft |

---

## 8. AI-használati elvek

1. **Az AI javasol, a szakértő dönt.** Semmi nem kerül riportba emberi jóváhagyás nélkül.
2. **Bizonyíték nélkül nincs állítás.** Szó szerinti idézet, időbélyeg vagy dokumentum-hivatkozás kell hozzá.
3. **A feltöltött tartalom adat, nem utasítás.** Az AI a leiratba vagy dokumentumba rejtett „utasításokat” nem követi.
4. **Adatvédelem:** hozzájárulás a felvételhez, álnév a kulcsembereknél, a hangfájl törlése, EU-s adatkezelés, adatfeldolgozói szerződések.
5. **Kulcs nélkül is használható:** a szabályalapú részek (kérdéslista, pontozás, akcióterv) AI nélkül is működnek; az AI gyorsít, de nem feltétel.

---

## 9. Technológia (röviden)

- **Webes alkalmazás:** Next.js (React), Tailwind; magyar nyelvű felület, mobilon is használható.
- **Adatbázis és fájltár:** Supabase (PostgreSQL, EU régió), sorszintű jogosultságkezeléssel és audit naplóval.
- **AI:** Claude API (elemzés, kérdésjavaslat); Azure AI Speech (magyar leirat).
- **Tesztelés:** 29 automatikus teszt, plusz adatbázis-jogosultsági tesztek.

---

## 10. Ami már kipróbálható

- **Red Flag mátrix:** pipálás, pontozás, forintosítás, mátrix, akcióterv, pipeline, kredit, típusválasztó.
- **Interjúk oldal:** kérdéslista szerepkör és típus szerint; minta-interjú betöltése; minta-elemzés ellentmondásokkal; elfogadott javaslat átvétele a mátrixba.
- Élő AI-elemzéshez és hangfeldolgozáshoz API-kulcsok kellenek. Ezek nélkül a program demó módban, egyértelmű „Minta” jelöléssel fut.

---

## 11. Nyitott kérdések a szolgáltatástervezéshez

**Termék és árazás**
1. Egy ár mind a 7 átvilágítás-típusra, vagy típusonként külön csomag (pl. buy-side DD magasabb áron)?
2. Mennyi ideig érvényes az 1,2 M Ft-os kredit (pl. 6 vagy 12 hónap), és beszámít-e minden divízió szolgáltatásába?
3. Legyen-e „Standard” (4 hetes) és „Prémium” (teljes VDD) felárazott szint, és mi különbözteti meg őket?

**Folyamat és kapacitás**
4. Hogyan oszlik meg a 10 nap? (Javaslat: 1–3. nap adatbekérés, 3–5. nap interjúk, 5–8. nap elemzés, 9. nap partneri review, 10. nap riport-prezentáció.)
5. Ki készíti az interjúkat: pillérenként a szakértő, vagy egy dedikált interjúer, aki mind a négy pillért lefedi?
6. Hány interjú fér bele a keretbe (javaslat: 2–4 × 45–60 perc)?
7. Mi történik, ha az ügyfél nem tölti fel időben a dokumentumokat: csúszik a határidő, vagy a riport jelzi a hiányt?

**Ügyfélélmény**
8. Mit lát az ügyfél a folyamat közben (csak státuszt, vagy részeredményeket is)?
9. Egyetlen riport készül, vagy a típustól függően több címzettnek más-más változat (pl. eladó és vevő)?
10. Van-e záró prezentáció, és ott hangzik-e el a javítási ajánlat?

**Értékesítés és utókövetés**
11. Ki viszi a leadet: az audit partnere vagy a divízió? Hogyan osztják a jutalékot?
12. Legyen-e 6 hónapos „újramérés” (follow-up Health Check), amely megmutatja a javulást?

**Kockázat és felelősség**
13. Milyen felelősségkorlátozás szerepeljen a megbízási szerződésben egy expressz audithoz?
14. Hogyan tájékoztatjuk az ügyfelet az AI használatáról (szerződésben, adatkezelési tájékoztatóban)?

---

*Utolsó frissítés: 2026. szeptember. A prototípus forráskódja a `health-check/` mappában van; részletes műszaki leírás a `docs/` mappában.*
