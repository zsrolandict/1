# ICT Európa – K+F Adódiagnosztika

Belső szakértői eszköz ügyfélcégek K+F projektjeinek gyors átvilágításához: adómegtakarítás forintosítása, SZTNH/Frascati-kockázat pontozása és nyomtatható vezetői riport generálása.

```bash
cd rd-tax-tool
npm install
npm run dev        # http://localhost:5173
npm test           # a számítási motor, a pontozás és a pecsét egységtesztjei
npm run build      # típusellenőrzés + produkciós build (dist/)
```

A fejlécben a **Demó eset** gomb betölt egy kitalált gépipari ügyfelet.

## Architektúra

A kód három rétegből áll. A folyamat öt lépés: Ügyféladatok → Költség & bér → SZTNH audit → Szoftver (IP-box) → Eredménytábla. A fejlécben átváltható egy önálló Szoftverjogdíj-kalkulátor nézetre. Az üzleti logika React nélkül, önállóan tesztelhető.

```
src/
├── domain/                 ← tiszta TypeScript, nincs UI-függőség
│   ├── types.ts            típusdefiníciók (ügyfél, költség, eredmény, audit)
│   ├── constants.ts        törvényi kulcsok, Frascati-kritériumok, kockázati jelzők
│   ├── engine.ts           megtakarítási motor (Szocho, Tao, HIPA, innovációs járulék)
│   ├── scoring.ts          SZTNH/Frascati kockázati pontozás (0–100)
│   ├── seal.ts             SHA-256 lezárás és ellenőrzés (Web Crypto API)
│   ├── software.ts         Szoftver IP-box: komponensek, 75 napos bejelentés, kumulatív nexus, éves jogdíj, eladás
│   ├── actionPlan.ts       3 lépéses ütemterv a kockázati sáv alapján
│   ├── format.ts           HUF-formázás, adószám-validáció
│   ├── defaults.ts         üres és demó vizsgálat
│   └── engine.test.ts      Vitest egységtesztek
├── state/
│   └── useAssessment.ts    useReducer + localStorage-autosave + JSON export/import
└── components/
    ├── layout/             AppHeader, Stepper, LiveSummary (valós idejű oldalpanel)
    ├── steps/              ClientStep → CostStep → AuditStep → ResultsStep
    ├── software/           SoftwareStep (4. lépés), RoyaltyCalculator (demó mód), közös elemek
    ├── charts/             RiskGauge, SavingsBreakdown, CriteriaBars (SVG/CSS, külső lib nélkül)
    ├── report/             ExecutiveReport (A4, nyomtatás/PDF), ActionPlan, SealPanel
    └── ui/                 Card, Button, űrlapmezők (CurrencyInput csúszkával, Segmented, Toggle)
```

### Komponensfa

```
App
├── AppHeader              demó · megnyitás · mentés (JSON) · új vizsgálat
├── Stepper                4 lépés, a hiányos lépésen jelzéssel
├── main
│   ├── [1–4. lépés]  grid: lépés-űrlap │ LiveSummary (összesen + bontás + mérő)
│   │   ├── ClientStep     cégnév, adószám, iparág, árbevétel, AEE, cégméret (mikro/kis, közép, nagy)
│   │   ├── CostStep       PhD / doktorandusz bér + létszám, mérnöki bér + kedvezményút, anyag, prototípus, alvállalkozó,
│   │   │                  HIPA-kulcs, számítás levezetése, figyelmeztetések
│   │   ├── AuditStep      5 Frascati-kérdés (0–4), általános + iparági NAV-kockázati csekklista, megjegyzés
│   │   └── SoftwareStep   eredeti + továbbfejlesztések (75 napos bejelentés), éves jogdíj, SaaS-feltétel, eladás
│   └── [5. lépés] ResultsStep
│       ├── KPI-sor        éves megtakarítás · többéves potenciál · SZTNH-mérő
│       ├── SavingsBreakdown, CriteriaBars, SealPanel, javaslatok, ActionPlan, levezetés
│       └── ExecutiveReport  (riport előnézet)
└── .print-only → ExecutiveReport   (bármely lépésből nyomtatáskor ez jelenik meg)
```

Adatfolyam: a teljes vizsgálat egyetlen `Assessment` objektum. A `useAssessment` ebből `useMemo`-val számolja a `SavingsResult`, `AuditResult` és `ActionStep[]` értékeket, ezeket nem tárolja. Így a dashboard, az oldalpanel és a nyomtatott riport mindig ugyanazokat a számokat mutatja.

## Számítási szabályok

| Jogcím | Képlet | Hivatkozás |
|---|---|---|
| Szocho – PhD | min(bér; fő × hónap × 500 000 Ft) × 13% (100% mentesség) | Szocho tv. 15. § |
| Szocho – doktorandusz | min(bér; fő × hónap × 200 000 Ft) × 6,5% (50% mentesség) | Szocho tv. 15. § |
| Szocho – fokozat nélküli K+F mérnök | bér × 6,5%, **csak ha a 16. § utat választják**; ekkor ez a bér nem vonható le a Tao-ban | Szocho tv. 16. § |
| Közvetlen K+F költség | bérek (+ opcionálisan a fizetendő szocho) + anyag + prototípus + alvállalkozó | Tao. tv. 7. § (1) t) |
| Tao | (K+F költség − támogatásból fedezett rész − 16. § úton a mérnöki bérek + egyetemi többlet) × 9% | Tao. tv. 7. § (1) t) |
| Tao – egyetemi együttműködés | az egyetemmel / kutatóintézettel közös rész 3×-a, legfeljebb 50 M Ft (de minimis) | Tao. tv. 7. § |
| HIPA | (K+F költség − támogatásból fedezett rész − más soron már levont anyag / alvállalkozói díj) × helyi kulcs (max. 2%) | Htv. 39. § |
| Innovációs járulék | ugyanaz az alap × 0,3%, csak közép- és nagyvállalatnál | Inno. tv. 17. § |
| Szoftver – jogdíj | min(jogdíjnyereség × 50% × nexus; adózás előtti eredmény × 50%) × 9% + jogdíjbevétel × HIPA-kulcs | Tao. tv. 7. § (1) s), Htv. 39. § |
| **Összesen** | Szocho + Tao + HIPA + innovációs járulék + IP-box (éves rész) | |
| Nettó | összesen − 9% × (szocho + HIPA + járulék megtakarítás) – nyereséges cégnél | |

A motor a fenti képleteken túl a következőket kezeli:

- **Mérnöki bérek két útja:** a program mindkét utat kiszámolja, és azt javasolja, amelyik a tárgyévben több pénzt hoz. Nyereséges cégnél ez általában a Tao (9%); veszteséges évben a szocho-kedvezmény (6,5%), mert az azonnal realizálódik, a Tao-hatás viszont csak elhatárolt veszteség lesz.
- **Havi plafonok:** a PhD- és doktorandusz-kedvezmény fejenként és havonta korlátos; létszám és foglalkoztatási hónapok nélkül a kedvezmény 0 Ft, erről a program figyelmeztet. A plafon feletti bérrészt külön kimutatja.
- **Tao realizálhatósága:** a 9%-os hatás teljes összege a főszám, de a motor külön kimutatja, mennyi érvényesíthető a tárgyévben (az adózás előtti eredmény erejéig), és mennyi válik elhatárolt veszteséggé.
- **HIPA és innovációs járulék korlátja:** a levonás legfeljebb az árbevétel összegéig érvényesül.
- **Bemenetek:** a negatív és a nem véges értékeket nullának veszi; a 2% feletti HIPA-kulcsot 2%-ra csökkenti, és erről figyelmeztet.
- **Többéves potenciál:** éves megtakarítás × (1 + önellenőrzéssel bevont évek száma, 0–5), azonos költségszerkezetet feltételezve.

## SZTNH / Frascati pontozás

```
pont_i = súly_i × értékelés_i / 4        (értékelés 0–4)
alap   = Σ pont_i                         (súlyok: Újszerűség 25, Kreativitás 20,
                                            Bizonytalanság 25, Rendszerezettség 15,
                                            Átadhatóság 15)
végső  = alap − Σ kockázati levonás       (0–100 közé szorítva)
```

- **Kizáró szabály (knock-out):** ha bármelyik kritérium 0 értékelést kap, vagy be van jelölve a „gyártás-előkészítés” kritikus jelző, a pontszám legfeljebb 49 (piros sáv).
- **Általános kockázati jelzők:** gyártás-előkészítés −25 (kizáró), rutinszerű QA −15, ügyfélspecifikus testreszabás −15, hipotézis hiánya −10, munkaidő-nyilvántartás hiánya −10.
- **Iparági kockázati jelzők:** az ügyfél iparága szerint további 2-2 jellemző buktató jelenik meg (pl. gépiparban szerszámgyártás és CE-tanúsítás, vegyiparban scale-up, élelmiszeriparban receptvariáns, elektronikában alkatrész-kiváltás, szoftvernél rutinszerű hibajavítás és adatmigráció). Iparágváltáskor a másik iparág jelzői nem számítanak bele.
- **Sávok:** Zöld 80–100 (adóálló) · Sárga 50–79 (kiegészítendő) · Piros <50 (NAV-kockázat).

## Szoftver (IP-box)

Külön lépés a saját fejlesztésű, hasznosított szoftverre, a teljes életúttal (`src/domain/software.ts`). A szabályokat az adócsapat 2026 szeptemberében megerősítette.

| Téma | Szabály a motorban | Hivatkozás |
|---|---|---|
| Bejelentés | Az eredeti fejlesztést **és minden aktivált továbbfejlesztést külön**, az aktiválástól számított **75 napon** belül kell bejelenteni; jogvesztő | Tao. tv. 4. § 5. |
| Nexus | **Kumulatív**: az adott év végéig aktivált összes fejlesztés költségéből, min(1; saját × 1,3 / (saját + kapcsolt + vásárolt)); csak Tao | Tao. tv. 7. § (22)–(25) |
| Jogdíj – Tao | évente: min(jogdíjnyereség × 50% × nexus; adózás előtti eredmény × 50%) × 9%; teljes nexusnál 4,5% tényleges Tao | Tao. tv. 7. § (1) s) |
| Jogdíj – HIPA | a jogdíjbevétel **100%-a** levonható, **nexus nélkül**; az innovációs járulék alapja ugyanez | Htv. 39. § (1) |
| SaaS | alapesetben szolgáltatás, nem jogdíj; kedvezmény csak elkülönített szerzői jogi licencdíjra (ÁSZF + számla) | |
| K+F + jogdíj | mindkettő jár: fejlesztési években K+F-kedvezmények, hasznosításkor jogdíjkedvezmény | |
| Eladás | nyereség = ár − könyv szerinti érték; mentes, ha az eredeti határidőben bejelentve és az **eredeti szerzés óta** eltelt 1 év (továbbfejlesztés nem indítja újra); a be nem jelentett továbbfejlesztés értéknövekményére jutó nyereség adóköteles | Tao. tv. 7. § (1) |
| Aktivált fejlesztés | a K+F Tao-levonás választhatóan a felmerülés évében egy összegben, vagy az értékcsökkenéssel arányosan; kettős levonás tilos | Tao. tv. 7. § (1) t) |

- A lépésben a szoftverhez tetszőleges számú továbbfejlesztés vehető fel, mindegyik saját határidő-jelzővel. A lejáró határidők a lépéslistán, az akciótervben és a riportban is kiemelve jelennek meg.
- A jogdíj évenként vihető fel (bevétel, kapcsolódó ráfordítás, adózás előtti eredmény). Az éves összesítőbe a vizsgált adóév sora kerül, a táblázat a többi év hatását is mutatja.
- Az eladási nyereségre a nexus-arány alkalmazása kapcsolható (alapértelmezetten be, konzervatív).

### Szoftverjogdíj-kalkulátor (demó mód)

A fejlécben a **Szoftverjogdíj-kalkulátor** nézet egy oldalon számol: éves jogdíjbevétel − levonható ráfordítás → Tao-, HIPA- és innovációsjárulék-megtakarítás, tényleges adókulccsal és „kedvezmény nélkül / kedvezménnyel” összevetéssel. Ugyanazt a motort és adatot használja, mint a teljes átvilágítás; a bejelentéseket, továbbfejlesztéseket és az eladást a teljes nézet kezeli.

## Tao / HIPA szakmai review (2026. szeptember)

A teljes számítási motor átnézése a Tao- és HIPA-szabályok szerint. Javított hibák és bővítések:

1. **HIPA dupla levonás (javítva, jelentős):** a korábbi változat a teljes K+F költséget levonta a HIPA-alapból, holott az anyagköltséget a HIPA-alap általános jogcímen már csökkenti. Egy költség csak egyszer vonható le (NAV: ez gyakori ellenőrzési hiba). Az anyagköltség alapértelmezetten kimarad a K+F-levonásból; az alvállalkozói díjra kapcsoló van. Ugyanez érinti az innovációs járulékot. A demó esetben ez 440 000 Ft HIPA- és 66 000 Ft járulék-túlbecslést szüntetett meg.
2. **Támogatásból fedezett költség (új):** a vissza nem térítendő támogatásból fedezett rész kimarad a Tao- és HIPA-alapból (konzervatív; a támogatási szerződés szerint ellenőrizendő).
3. **Egyetemi / kutatóintézeti együttműködés (új):** a közös K+F költség háromszorosa vonható le, legfeljebb 50 M Ft; a többlet de minimis támogatás.
4. **Elhatárolt veszteség (pontosítva):** a figyelmeztetés jelzi, hogy a későbbi években a veszteség legfeljebb az adóalap 50%-áig írható le.
5. **Nettó hatás (új):** a szocho-, HIPA- és járulékmegtakarítás csökkenti a költségeket, így növeli a Tao-alapot. A program a törvényi összeg mellett a Tao-hatással korrigált nettó összeget is kimutatja.
6. **Hatékony támogatási arány (pontosítva):** csak a K+F-kedvezményekből számol, az IP-box jövedelmi kedvezményét nem veti a K+F költségre.
7. **Pecsét-kompatibilitás:** a korábbi motorverziókkal (2026.2, 2026.3) lezárt ügyek a fájlban tárolt eredeti adatokon ellenőrződnek, így az új mezők és az adatmigráció után is érvényesek maradnak; a módosított régi fájl továbbra is érvénytelen.
8. **Akadálymentesség:** telefonon a csak ikonnal megjelenő fejléc- és lépésgombok akadálymentes nevet kaptak.

## Lezárás (SHA-256 pecsét)

Az Eredménytáblán az **Ügy lezárása** gomb a teljes adatcsomagról (ügyfél, költségek, paraméterek, auditválaszok, korábbi pecsétek) és a lezárás adatairól (időpont, tanácsadó, motorverzió) SHA-256 ujjlenyomatot készít a böngésző Web Crypto API-jával (`src/domain/seal.ts`).

- A lezárt ügy csak olvasható; a riport alján megjelenik az időpont és a teljes ujjlenyomat.
- Mentett JSON betöltésekor a program újraszámolja az ujjlenyomatot. Ha a fájlt a lezárás után bárki átírta, piros „Pecsét érvénytelen” jelzés jelenik meg minden lépésen és a riporton.
- Az **Új verzió nyitása** szerkeszthető másolatot nyit; a korábbi pecsét az előzmények közé kerül, és maga is része lesz a következő lezárás ujjlenyomatának.
- **Korlát:** az időpont a tanácsadó gépének órájából származik, és a hash a sértetlenséget bizonyítja, nem az időpontot. Jogilag minősített időbélyeghez (eIDAS) külső bizalmi szolgáltató kell (III. fázis).

## Szakmai egyeztetést igénylő pontok

A 2026. szeptemberi változatban a szocho-plafonok és az innovációs járulék alanyisága az adócsapat visszajelzése és nyilvános források alapján került be. Nyitva maradt:

- **Szocho 16. §:** van-e havi vagy éves felső korlátja, és pontosan mely munkakörökre (FEOR) vehető igénybe.
- **Szocho 15. §:** kizárja-e a Tao-levonást ugyanarra a bérre, hasonlóan a 16. §-hoz. A motor jelenleg nem zárja ki.
- **Szocho 15. §:** feltétele-e, hogy a munkáltató kutatóhelyként működjön.
- **HIPA-alap:** az ELÁBÉ-t és a közvetített szolgáltatást az eszköz nem kéri be; a K+F-levonás felső korlátja az árbevétel.
- **Támogatás:** pontosan mely jogszabályhely zárja ki a támogatásból fedezett költséget a Tao- és a HIPA-levonásból (az eszköz konzervatívan mindkettőből kizárja).
- **Bejelentési határidő:** az adócsapat szerint 75 nap; egy korábbi nyilvános forrás 60 napot említett. A hatályos szöveget érdemes egyszer ellenőrizni (`IP_RULES.NOTIFICATION_DAYS`).
- **Eladás:** vonatkozik-e a nexus-arány az eladási nyereségre (kapcsolóval állítható).
- **Kapcsolt vállalkozástól vett K+F szolgáltatás:** a Tao-levonás feltételei (az eszköz csak figyelmeztet).

## Nyomtatás / PDF

A **Nyomtatás / PDF** gomb a böngésző nyomtatási párbeszédablakát nyitja meg (`window.print()`). A nyomtatási CSS elrejti a felületet, és csak az `ExecutiveReport` jelenik meg két A4-es oldalon. PDF-et a párbeszédablakban a „Mentés PDF-ként” célhellyel lehet készíteni.

## Adatkezelés

A vizsgálat adatai csak a tanácsadó böngészőjében (`localStorage`) maradnak meg; szerverre semmi nem kerül. Egy ügy archiválásához használja a **Mentés (JSON)** funkciót, a mentett fájlt később a **Megnyitás** gombbal lehet visszatölteni.
