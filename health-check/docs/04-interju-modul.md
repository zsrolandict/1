# 4. Interjúmodul és átvilágítás-típusok

## Átvilágítás-típusok

Ugyanaz a motor, katalógus és interjúmodul szolgál ki minden átvilágítás-fajtát. A típus csak a hangsúlyokat, a keretet és a riport címzettjét állítja be (`lib/engagement/kinds.ts`, DB: `engagements.kind`).

| Típus | Kinek szól | Fókusz | Keret |
|---|---|---|---|
| Vállalati Health Check | tulajdonos | általános állapot, 90 napos terv | 18 ó |
| Vendor DD (eladói) | eladó és vevők | értékvédelem: a vevő által várható találatok előzetes javítása | 21 ó |
| Buy-side DD (vevői) | vevő / befektető | árazás, garanciák, kártalanítás | 21 ó |
| Finanszírozási felkészültség | bank / befektető | cash-flow minősége, kovenánsok | 18 ó |
| Generációváltás / utódlás | alapító család | kulcsember, tulajdonosi struktúra | 20 ó |
| Megfelelőségi audit | vezetés / FB | adó, munkajog, GDPR, engedélyek | 19 ó |
| Akvizíció utáni integráció | új tulajdonos | első 100 nap, megtartás | 20 ó |

A típus hatása:
- a pillérek súlya szerint rendeződnek a kérdések;
- minden típusnak vannak kiemelt kockázati kódjai, ezek kötelező kérdést kapnak;
- minden típushoz tartozik egy saját kérdéscsoport (pl. utódlásnál: „Ki a kijelölt utód?”).

## Folyamat

```
 Red Flag mátrix ─┐
 Hiányzó dok.  ───┼─► 1. KÉRDÉSEK  (szabályalapú, azonnal; + opcionális AI-bővítés)
 Dok.-tények   ───┘          │
                             ▼
               2. INTERJÚ ─► hangfájl ──(hozzájárulás!)──► Azure Speech ─► leirat
                          └► jegyzet / diktálás ───────────────────────► leirat
                             │   (beszélők átnevezése: „Beszélő 1” → „Ügyvezető”)
                             ▼
               3. ELEMZÉS (Claude) ─► idézet-ellenőrzés ─► tanácsadó dönt
                     • összefoglaló              • elfogad → Red Flag mátrix
                     • ellentmondások a dok.-okkal
                     • javasolt red flagek
                     • követő kérdések
```

## 1. Kérdésgenerálás (`lib/interview/guide.ts`)

A kérdéslista AI nélkül, determinisztikusan készül el, így kulcs nélkül is működik, és ugyanazokból az adatokból mindig ugyanaz lesz az eredmény. Forrásai prioritás szerint:

1. **Azonosított red flagek** az interjúalany illetékességi pilléreiben. A piros és a típus szerint kiemelt tételek kötelezők.
2. **Hiányzó dokumentumok:** „Létezik ilyen? Ki pótolja, mikorra?”
3. **Dokumentumokból ismert tények:** nyitott kérdésként kell megerősíttetni őket, és ebből derülnek ki az ellentmondások.
4. **A szerepkör alapkérdései** (ügyvezető, CFO, HR-vezető, operációs, értékesítési, IT-vezető, kulcsember).
5. **Típus-specifikus kérdések.**

Az **AI-bővítés** (`/api/interviews/guide`, `withAi: true`) legfeljebb 6 további, célzott kérdést javasol, és nem ismétli a meglévőket.

## 2. Leirat

- **Hangfájl:** Azure AI Speech „fast transcription”, `hu-HU`, beszélő-szétválasztással (2–6 fő). A hangot nem tároljuk, a szerver memóriában továbbítja, csak a leirat marad meg. Ha élesben mégis tároljuk, a `recording_delete_after` mező után automatikusan törlődik.
- **Jegyzet:** `[00:12:30] Ügyvezető: …` sorok időbélyeggel, `Kérdező: …` sorok beszélővel, vagy szabad szöveg. Időbélyeget csak akkor mutatunk, ha valóban van.
- **Hozzájárulás:** hangfeldolgozás csak bepipált hozzájárulással indulhat (UI + API). Az adatbázis sem enged hozzájárulás nélküli felvételt (`recording_requires_consent`).

## 3. Elemzés (`lib/interview/ai.server.ts`)

- **Modell és kimenet:** `claude-opus-5`, adaptív gondolkodás, strukturált JSON-kimenet Zod-sémával. Ha a modell elutasítja a kérést, a szerver automatikusan egy tartalékmodellel próbálja újra (`fallbacks: "default"`).
- **A bemenet adat, nem utasítás:** a rendszerprompt kifejezetten így kezeli a leiratot. Ez védelem az ellen, hogy a szövegbe rejtett „utasítás” átvegye az irányítást.
- **Hallucináció elleni védelem** (`verifyAnalysis`):
  - minden állítás, javaslat és ellentmondás csak akkor marad meg, ha az idézete **szó szerint megtalálható a leiratban** (ékezet- és írásjel-függetlenül);
  - az időbélyeget és a beszélőt a leiratból vesszük, nem a modelltől;
  - ellentmondás csak létező, megadott tényre hivatkozhat;
  - a kiszűrt tételek számát a felület kiírja.
- **Emberi döntés:** a javaslat csak akkor kerül a Red Flag mátrixba, ha a tanácsadó elfogadja. Ott „AI · interjú” jelölést és az idézetet kapja bizonyítékként. A súlyosságot sosem csökkenti.
- **Adatbázis:** minden tétel külön `interview_findings` sor döntéssel (`PENDING`/`ACCEPTED`/`REJECTED`), döntéshozóval és időponttal (auditálható).

## Adatvédelem – teendők élesítés előtt

- [ ] Adatfeldolgozói szerződés (DPA) az Anthropic-kal és a Microsofttal; EU-s adatkezelési beállítások ellenőrzése.
- [ ] Interjú-tájékoztató és hozzájárulási nyilatkozat szövege (jogi jóváhagyás).
- [ ] HR 361 interjúk: `confidential = true`, pszeudonim alias, csak HR-szakértő és partner láthatja (RLS tesztelve).
- [ ] Megőrzési idő a leiratokra (a megbízási szerződés szerint), törlési job.
- [ ] Az API-végpontok az MVP-ben hitelesítés nélküliek. Élesben Supabase-munkamenet és projekt-tagság ellenőrzése szükséges.

## Beállítás

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
npm run dev                  # http://localhost:3000/interjuk
```

Kulcsok nélkül is kipróbálható: a „Minta interjú betöltése” és a „Minta-elemzés megtekintése” gomb egy kitalált interjút és egy előre elkészített, „Minta” címkéjű elemzést mutat. Az idézet-ellenőrzés ezen is lefut: a mintában szándékosan van egy kitalált idézet, amit a szűrő kiejt.
