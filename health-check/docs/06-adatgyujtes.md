# 6. Adatgyűjtés és automatikus előjelölés

Az `/adatok` oldal három forrásból készít **javaslatokat** a Red Flag mátrixhoz. A javaslat a szakértő elfogadásával kerül a mátrixba; addig semmit nem módosít. Mindhárom forrás ugyanazt a formát adja (`lib/intake/types.ts`), így a beolvasztás szabályai is közösek (`lib/intake/apply.ts`).

| Forrás | Hogyan dolgozik | AI? | Hol fut |
|---|---|---|---|
| **1. Ügyfélkérdőív** (30 kérdés) | Rögzített szabályok: a válasz → tétel, valószínűség, hatás, képlet-paraméter | nem | böngésző |
| **2. Adattáblák** (CSV/XLSX) | Számolt mutatók küszöbökkel | nem | böngésző (a fájl nem megy fel) |
| **3. Dokumentumok** (PDF/DOCX/TXT) | Maszkolás → Claude → idézet-ellenőrzés | igen | szerver (a fájlt nem tároljuk) |

## Beolvasztási szabályok

- **Már azonosított tétel:** a valószínűség és a hatás nem csökken (a szakértő korábbi döntése marad).
- **Nem azonosított tétel:** bepipáljuk, a javaslat értékeivel.
- **Hiányzó tétel, de van sablonja** (alapkatalógus, típus- vagy szektortétel): a sablonból vesszük fel.
- **Ismeretlen kockázat:** új egyedi tétel (`CUS-nn`).
- **Képlet:** a tényadat (pl. érintett árbevétel-arány 38%, 4 hiányzó nyilvántartás) felváltja a katalógus feltételezését; a szakértői felülírás megmarad.
- **Összeg a forrásban:** csak emelheti a kitettséget.
- A bizonyíték (kérdőív-kérdés és válasz, tábla és mutató, idézet oldalszámmal) a tételhez fűződik, és a riportba is bekerül. A mátrix a forrást jelöli: *Kérdőív*, *Adattábla*, *AI · dokumentum*.
- Minden forrás **tényeket** is ad az interjúkhoz: az interjú-elemzés ezekkel szemben keres ellentmondást. A dokumentum-tényekre külön kérdés is készül; a kérdőív- és táblaadatok csak az ellentmondás-kereséshez kellenek.

## 1. Kérdőív (`lib/intake/checklist.ts`)

30 kérdés négy pillérben; feltételes kérdések (pl. „Hány ügylethez hiányzik a nyilvántartás?” csak „nem” válasz után). A szabályok **adatként** vannak megadva, így élesben a `checklist_questions.rules` oszlopból tölthetők, és a partner kódmódosítás nélkül hangolhatja őket.

```ts
{ when: { gte: 25 }, code: 'LEG-01', likelihood: 3, impact: 5, valuationFromAnswer: 'SHARE',
  note: 'Az árbevétel negyedét meghaladó érintettség kritikus.' }
```

Egy tételre több szabály is illeszkedhet: a legsúlyosabb érvényes, a bizonyíték összeadódik. Típusfüggő kód: a cash-flow terv hiánya finanszírozásnál `FIK-02`, egyébként `HC-02`.

## 2. Adattáblák (`lib/intake/tables/`)

| Tábla | Mutatók | Javaslat, ha… |
|---|---|---|
| Vevői korosítás | nyitott állomány, 90 napon túli arány, legnagyobb késedelmes vevő, **DSO** | 90 napon túl ≥ 15% vagy DSO-többlet ≥ 15 nap → `FIN-03`; DSO → cégadat |
| Vevőnkénti árbevétel | legnagyobb vevő, top 5, **HHI** | legnagyobb vevő ≥ 25% → `OPS-05` (arány a képletbe); összeg → árbevétel cégadat |
| Szállítónkénti beszerzés | legnagyobb és top 3 szállító | legnagyobb ≥ 40% → `OPS-01` |
| Kapcsolt ügyletek | 50 M Ft feletti ügyletek, ebből nyilvántartás nélkül | ≥ 1 → `FIN-01` (darabszám a képletbe) |

Beolvasás: UTF-8 vagy Windows-1250 CSV (magyar Excel-mentés), pontosvessző/vessző/tab, magyar és angol számformátum, `2026.03.15.` és Excel-dátumsorszám, XLSX első munkalapja. A fejlécsort és az oszlopokat szinonimák alapján ismeri fel (első 10 sor); a felületen átállítható. Összesítő sorokat kihagy. Ha a vevőnkénti árbevétel is be van töltve, a DSO abból számol.

## 3. Dokumentumok (`lib/intake/documents/`, `POST /api/documents/analyze`)

1. **Szövegkinyerés:** PDF oldalanként (pdf.js / `unpdf`), Word és szöveg ~3500 karakteres szakaszokban. Szkennelt PDF (nincs szövegréteg) → hibaüzenet, OCR szükséges.
2. **Maszkolás** a hívás előtt: e-mail, telefon, IBAN/bankszámla, adóazonosító jel, TAJ, igazolványszám. A személyneveket szabály nem ismeri fel megbízhatóan: azokat az EU-régiós, adatmegőrzés nélküli feldolgozás védi.
3. **Claude-elemzés** strukturált kimenettel: dokumentumtípus, összefoglaló, kockázatok katalóguskóddal, tények, hiányzó szokásos rendelkezések. A dokumentum szövege adat, nem utasítás (prompt-injekció elleni szabály).
4. **Ellenőrzés:** minden kockázatnak és ténynek szó szerint szerepelnie kell a (maszkolt) szövegben; az oldalszámot a rendszer állapítja meg. Ismeretlen katalóguskód → új egyedi tétel. A kiszűrt tételek száma látszik.
5. A fájlt a szerver nem tárolja; a munkaállapotba csak az ellenőrzött eredmény kerül.

Korlátok: 20 MB, 300 oldal, 300 000 karakter elemzésenként.

## Adatbázis (`0005_intake.sql`)

- `intake_tables`: táblánként a mutatók és a forrásfájl SHA-256 lenyomata (nyers adat nélkül).
- `intake_suggestions`: egységes javaslat-sor, döntéssel (`PENDING` / `ACCEPTED` / `REJECTED`), döntéshozóval és időponttal; dokumentumnál idézet és dokumentum kötelező. Audit-napló, pillér-szintű jogosultság.
- `red_flags.source` új értéke: `DATA_TABLE`; `checklist_questions.rules` és `show_if`.

## Mintaadatok

Mind a négy mintaesethez van kitalált kérdőív-válaszsor, négy mintatábla és 1–2 mintadokumentum előre elkészített elemzéssel. A válaszok szándékosan az ügyfél önértékelését tükrözik, és helyenként szépítenek: az IT-cég például azt írja, minden fejlesztői szerződés rendben van, a mintaszerződés viszont tulajdonosváltáskor azonnali felmondást enged. A gyártó mintában egy szándékosan kitalált idézet mutatja, hogyan szűri ki a rendszer a nem igazolható állítást.
