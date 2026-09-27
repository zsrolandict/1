# ICT Európa – K+F Adódiagnosztika

Belső szakértői eszköz ügyfélcégek K+F projektjeinek gyors átvilágításához: adómegtakarítás forintosítása, SZTNH/Frascati-kockázat pontozása és nyomtatható vezetői riport generálása.

```bash
cd rd-tax-tool
npm install
npm run dev        # http://localhost:5173
npm test           # a számítási motor és a pontozás egységtesztjei
npm run build      # típusellenőrzés + produkciós build (dist/)
```

A fejlécben a **Demó eset** gomb betölt egy kitalált gépipari ügyfelet.

## Architektúra

A kód három rétegből áll. Az üzleti logika React nélkül, önállóan tesztelhető.

```
src/
├── domain/                 ← tiszta TypeScript, nincs UI-függőség
│   ├── types.ts            típusdefiníciók (ügyfél, költség, eredmény, audit)
│   ├── constants.ts        törvényi kulcsok, Frascati-kritériumok, kockázati jelzők
│   ├── engine.ts           megtakarítási motor (Szocho, Tao, HIPA, innovációs járulék)
│   ├── scoring.ts          SZTNH/Frascati kockázati pontozás (0–100)
│   ├── actionPlan.ts       3 lépéses ütemterv a kockázati sáv alapján
│   ├── format.ts           HUF-formázás, adószám-validáció
│   ├── defaults.ts         üres és demó vizsgálat
│   └── engine.test.ts      Vitest egységtesztek
├── state/
│   └── useAssessment.ts    useReducer + localStorage-autosave + JSON export/import
└── components/
    ├── layout/             AppHeader, Stepper, LiveSummary (valós idejű oldalpanel)
    ├── steps/              ClientStep → CostStep → AuditStep → ResultsStep
    ├── charts/             RiskGauge, SavingsBreakdown, CriteriaBars (SVG/CSS, külső lib nélkül)
    ├── report/             ExecutiveReport (A4, nyomtatás/PDF), ActionPlan
    └── ui/                 Card, Button, űrlapmezők (CurrencyInput csúszkával, Segmented, Toggle)
```

### Komponensfa

```
App
├── AppHeader              demó · megnyitás · mentés (JSON) · új vizsgálat
├── Stepper                4 lépés, a hiányos lépésen jelzéssel
├── main
│   ├── [1–3. lépés]  grid: lépés-űrlap │ LiveSummary (összesen + bontás + mérő)
│   │   ├── ClientStep     cégnév, adószám, iparág, árbevétel, AEE, Kkv/járulékköteles
│   │   ├── CostStep       bérek (mérnök / PhD), anyag, prototípus, alvállalkozó,
│   │   │                  HIPA-kulcs, számítás levezetése, figyelmeztetések
│   │   └── AuditStep      5 Frascati-kérdés (0–4), NAV-kockázati csekklista, megjegyzés
│   └── [4. lépés] ResultsStep
│       ├── KPI-sor        éves megtakarítás · többéves potenciál · SZTNH-mérő
│       ├── SavingsBreakdown, CriteriaBars, javaslatok, ActionPlan, levezetés
│       └── ExecutiveReport  (riport előnézet)
└── .print-only → ExecutiveReport   (bármely lépésből nyomtatáskor ez jelenik meg)
```

Adatfolyam: a teljes vizsgálat egyetlen `Assessment` objektum. A `useAssessment` ebből `useMemo`-val számolja a `SavingsResult`, `AuditResult` és `ActionStep[]` értékeket, ezeket nem tárolja. Így a dashboard, az oldalpanel és a nyomtatott riport mindig ugyanazokat a számokat mutatja.

## Számítási szabályok

| Jogcím | Képlet | Hivatkozás |
|---|---|---|
| Szocho | mérnöki bér × 13% × 50% (= 6,5%) + PhD bér × 13% × 100% | Szocho tv. 15. § |
| Közvetlen K+F költség | bérek (+ opcionálisan a fizetendő szocho) + anyag + prototípus + alvállalkozó | Tao. tv. 7. § (1) t) |
| Tao | közvetlen K+F költség × 9% | Tao. tv. 7. § (1) t) |
| HIPA | közvetlen K+F költség × helyi kulcs (alap 2%, max. 2%) | Htv. 39. § |
| Innovációs járulék | közvetlen K+F költség × 0,3%, csak járulékköteles cégnél | Inno. tv. |
| **Összesen** | Szocho + Tao + HIPA + innovációs járulék | |

A motor a fenti képleteken túl a következőket kezeli:

- **Tao realizálhatósága:** a 9%-os hatás teljes összege a főszám, de a motor külön kimutatja, mennyi érvényesíthető a tárgyévben (az adózás előtti eredmény erejéig), és mennyi válik elhatárolt veszteséggé. Így veszteséges ügyfélnél sem ígér túl sokat a riport.
- **HIPA és innovációs járulék korlátja:** a levonás legfeljebb az árbevétel összegéig érvényesül, mert az adóalap nem lehet negatív.
- **Bemenetek:** a negatív és a nem véges értékeket nullának veszi; a 2% feletti HIPA-kulcsot 2%-ra csökkenti, és erről figyelmeztet.
- **Többéves potenciál:** éves megtakarítás × (1 + önellenőrzéssel bevont évek száma, 0–5). Feltételezi, hogy a korábbi évek költségszerkezete azonos a tárgyévivel.

## SZTNH / Frascati pontozás

```
pont_i = súly_i × értékelés_i / 4        (értékelés 0–4)
alap   = Σ pont_i                         (súlyok: Újszerűség 25, Kreativitás 20,
                                            Bizonytalanság 25, Rendszerezettség 15,
                                            Átadhatóság 15)
végső  = alap − Σ kockázati levonás       (0–100 közé szorítva)
```

- **Kizáró szabály (knock-out):** a Frascati-kézikönyv szerint az öt kritériumnak együttesen kell teljesülnie. Ha bármelyik 0 értékelést kap, vagy be van jelölve a „gyártás-előkészítés” kritikus jelző, a pontszám legfeljebb 49 lehet, vagyis piros sávba kerül.
- **Kockázati jelzők:** gyártás-előkészítés −25 (kizáró), rutinszerű QA −15, ügyfélspecifikus testreszabás −15, hipotézis hiánya −10, munkaidő-nyilvántartás hiánya −10.
- **Sávok:** Zöld 80–100 (adóálló) · Sárga 50–79 (kiegészítendő) · Piros <50 (NAV-kockázat).

A súlyok és a levonások a `constants.ts` fájlban vannak, így a módszertan kódmódosítás nélkül is hangolható.

## Szakmai egyeztetést igénylő pontok

- **Innovációs járulék:** az eszköz a megrendelés szerinti két kategóriát használja (Kkv / járulékköteles). A felületi szöveg szerint a kkv-k, beleértve a középvállalkozásokat is, mentesek. A megrendelés viszont „közép- és nagyvállalatokat” említ kötelezettként. Kérjük, az adócsapat erősítse meg, melyik a helyes, és szükség esetén igazítsa a `ClientStep` szövegét.
- A szocho-kedvezmény esetleges törvényi felső korlátai (pl. a kedvezményalap havi korlátja) nincsenek modellezve.
- A HIPA-alapot csökkentő egyéb tételeket (ELÁBÉ, anyagköltség stb.) az eszköz nem kéri be; a felső korlát az árbevétel.

## Nyomtatás / PDF

A **Nyomtatás / PDF** gomb a böngésző nyomtatási párbeszédablakát nyitja meg (`window.print()`). A nyomtatási CSS elrejti a felületet, és csak az `ExecutiveReport` jelenik meg két A4-es oldalon. PDF-et a párbeszédablakban a „Mentés PDF-ként” célhellyel lehet készíteni.

## Adatkezelés

A vizsgálat adatai csak a tanácsadó böngészőjében (`localStorage`) maradnak meg; szerverre semmi nem kerül. Egy ügy archiválásához használja a **Mentés (JSON)** funkciót, a mentett fájlt később a **Megnyitás** gombbal lehet visszatölteni.
