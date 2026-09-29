# ICT Health Check · Internal Diagnostic & Due Diligence Tool

Belső eszköz az ICT Európa átvilágítási szolgáltatásaihoz. Nem csak vendor DD-re jó: ugyanaz a motor szolgálja ki a Health Checket, a vevői DD-t, a finanszírozási felkészültséget, az utódlást, a megfelelőségi auditot és az akvizíció utáni integrációt is (lásd [`docs/04-interju-modul.md`](docs/04-interju-modul.md)). Az eredeti fókusz a „Vállalati Health Check & Vendor Due Diligence”. Célcsoport: 1–5 Mrd Ft árbevételű KKV-k. Négy pilléren (Pénzügy, Jog, Operáció, HR) vizsgál, 10 napos vagy 4 hetes átfutással, 1,2 M Ft + ÁFA belépő áron, ~18–21 szakértői órás keretből.

> A repó gyökerében lévő Vite-alkalmazás (Smart Autodoc) független ettől a projekttől. Ez a könyvtár önálló Next.js alkalmazás.

## Tartalom

| # | Téma | Hol |
|---|---|---|
| 1 | Rendszerarchitektúra és tech stack | [`docs/01-architektura.md`](docs/01-architektura.md) |
| 2 | Adatmodell (Supabase / PostgreSQL DDL, RLS, nézetek) | [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) |
| 3 | UX/UI képernyőterv | [`docs/03-ux-kepernyoterv.md`](docs/03-ux-kepernyoterv.md) |
| 4 | MVP: Interaktív Red Flag Mátrix | [`components/risk/RedFlagMatrix.tsx`](components/risk/RedFlagMatrix.tsx) + [`lib/risk/`](lib/risk) |
| 5 | Interjúmodul: kérdésgenerálás, hang → leirat, AI-elemzés, ellentmondás-keresés | [`docs/04-interju-modul.md`](docs/04-interju-modul.md), [`lib/interview/`](lib/interview), `/interjuk` |
| 6 | Átvilágítás-típusok | [`lib/engagement/kinds.ts`](lib/engagement/kinds.ts), `supabase/migrations/0002_*.sql` |
| 7 | Forintosító képletek + szakmai indoklás | [`lib/risk/valuation.ts`](lib/risk/valuation.ts), [`lib/risk/parameters.ts`](lib/risk/parameters.ts), `0003_*.sql` |
| 8 | Egykattintásos PDF-riport (vezetői összefoglaló, scorecard, részletező, akcióterv, ajánlat) | [`lib/report/`](lib/report), „PDF riport” gomb |
| 9 | Bejelentkezés és API-védelem (Supabase) | [`lib/auth/`](lib/auth), `/login` |
| 10 | Adatgyűjtés: kérdőív-előjelölés, adattáblák (CSV/XLSX), AI-dokumentumelemzés | [`docs/06-adatgyujtes.md`](docs/06-adatgyujtes.md), [`lib/intake/`](lib/intake), `/adatok`, `0005_intake.sql` |
| 11 | Bővített modulok: tényállás, ágazatok, cégkivonat, összkép, mi lenne ha, vevői kérdések, utókövetés, időkeret, tudástár, kalauz és modulkapcsolók | [`docs/07-bovitett-modulok.md`](docs/07-bovitett-modulok.md), `/projekt`, `0006`–`0009` migrációk |

## Futtatás

```bash
cd health-check
npm install
cp .env.example .env.local   # opcionális: GEMINI_API_KEY vagy ANTHROPIC_API_KEY (+ AZURE_SPEECH_*) – nélkülük demó módban fut
npm run dev        # http://localhost:3000  (Red Flag mátrix) · /adatok (adatgyűjtés) · /interjuk (interjúk)
npm test           # motor + interjúmodul tesztjei (vitest; az AI-hívást helyi mock szerver ellenőrzi)
npm run typecheck
npm run build
```

### Adatbázis

Supabase CLI-vel:

```bash
supabase init            # ha még nincs config
supabase db reset        # lefuttatja a supabase/migrations/* fájlokat
```

„Csupasz” PostgreSQL 15+ esetén a Supabase `auth` séma stubjával és az RLS füstteszttel:

```bash
createdb hc_test
psql -d hc_test -f supabase/tests/00_auth_stub.sql \
                -f supabase/migrations/0001_init.sql \
                -f supabase/migrations/0002_interviews_and_kinds.sql \
                -f supabase/tests/01_rls_smoke.sql \
                -f supabase/migrations/0003_valuation_and_reasoning.sql \
                -f supabase/tests/02_interviews_smoke.sql \
                -f supabase/tests/03_valuation_smoke.sql \
                -f supabase/migrations/0004_materiality_expected_loss.sql \
                -f supabase/migrations/0005_intake.sql \
                -f supabase/migrations/0006_case_profile_requests.sql \
                -f supabase/migrations/0007_sectors_overview.sql \
                -f supabase/migrations/0008_snapshots.sql \
                -f supabase/migrations/0009_registry_benchmark_timesheet.sql \
                -f supabase/tests/07_benchmark_smoke.sql
```

A füstteszt öt felhasználó nézőpontjából ellenőrzi a láthatóságot: partner mindent lát, HR-szakértő csak HR-dokumentumot és kulcsember-interjút, pénzügyi szakértő csak főkönyvet, ügyfél csak a saját feltöltéseit, idegen ügyfél semmit. Emellett ellenőrzi, hogy a kredit-főkönyv append-only és nem mehet negatívba, és hogy pénzügyi szakértő nem írhat HR red flaget. Az interjús teszt azt ellenőrzi, hogy bizalmas (HR 361) interjút csak a HR-szakértő és a partner lát, az ügyfél egyetlen interjút sem, hozzájárulás nélkül nem menthető felvétel, és AI-találat nem létezhet idézet nélkül.

## Adatmodell röviden

```
companies 1─* engagements 1─* engagement_members *─1 profiles
                  │
                  ├─* checklist_responses *─1 checklist_questions *─1 checklist_templates
                  ├─* document_requests 1─* documents          (Storage: vdr/{engagement}/…)
                  ├─* worksheets (pillérenként 1)
                  │     ├ ebitda_adjustments, related_party_transactions   (FIN)
                  │     ├ supplier_exposures                               (OPS)
                  │     └ key_person_assessments                           (HR 361)
                  ├─* red_flags *─1 risk_templates
                  │     └─1 remediation_items 1─* leads ──► divíziók
                  ├─* reports (verziózott pillanatkép + PDF)
                  ├─* interviews 1─* interview_questions
                  │        ├─* interview_transcripts 1─* interview_findings ──► red_flags
                  │        └ hozzájárulás, pszeudonim, bizalmas jelölés, hangfájl-lejárat
                  ├─* hour_budgets, timesheet_entries  ──► v_engagement_burn, v_pillar_burn
                  └─* credit_ledger (append-only)      ──► v_credit_balance
```

## Kockázati motor (`lib/risk/engine.ts`)

| Szabály | Érték |
|---|---|
| Pontszám | valószínűség (1–5) × hatás (1–5) |
| RAG | ≥ 15 piros · 8–14 sárga · < 8 zöld; **várható veszteség ≥ lényegességi küszöb → piros** |
| Valószínűség | 1 → 5% · 2 → 20% · 3 → 40% · 4 → 65% · 5 → 90% |
| Várható veszteség | bruttó kitettség × valószínűség |
| Quick win | nem zöld és ≤ 5 munkanap → 0–30 nap |
| Akcióterv | quick win → 0–30 · piros → 31–60 · sárga → 61–90 · zöld → monitoring |
| Prioritás | 50% pontszám + 50% relatív várható veszteség (+0,15 quick win bónusz) |
| Health Score | pillérenként `100 × Π(1 − 0,6 × pont/25)`, összesítve a 4 pillér átlaga |
| Pipeline | csak sárga és piros tételből lesz lead; a kredit = min(audit díj, remediációs díjak) |

Ugyanez a RAG-logika SQL-ben is megvan: `red_flag_rag(likelihood, impact, exposure, materiality)` (0004).

## Következő lépések (javasolt sorrend)

> ✅ Kész: interjúkérdés-generátor, jegyzet/hang → leirat, AI-elemzés ellentmondás-kereséssel, átvilágítás-típusok,
> forintosító képletek felülírással, előtöltött szakmai indoklás, egykattintásos PDF-riport, API-végpontok bejelentkezés mögött,
> ügyfélkérdőív szabályalapú előjelöléssel, adattáblák mutatói (DSO, koncentráció, kapcsolt ügyletek), AI-dokumentumelemzés maszkolással és idézet-ellenőrzéssel.

### Forintosítás és indoklás

- A projekt fejlécében: **árbevétel, fedezeti hányad, DSO (tényleges / iparági), lényegességi küszöb**.
- Képlettípusok: **árbevétel-arány** (alapból az elmaradó *fedezettel* számol, kikapcsolható), **darabszám × tételösszeg**,
  **DSO-különbség** (lekötött forgótőke), **kézi**. A kitettség mező mellett látszik, hogy képletből jön-e („képlet”)
  vagy felül lett írva („felülírva · visszaállít”).
- Jogszabályi összeget nem kódolunk: az egységösszegek `lib/risk/parameters.ts` szakértői paraméterek, `approved: false`
  állapotban a felület „jóváhagyandó” jelzést ad, a PDF pedig **TERVEZET – nem kiadható** fejlécet kap.
- Minden katalógustétel **előtöltött, szerkeszthető szakmai indoklással** érkezik (sor lenyitása: ▸), ez kerül a riportba.

### PDF-riport

A „PDF riport” gomb a böngészőben állítja elő a dokumentumot (az adat nem hagyja el a gépet): címlap és vezetői
összefoglaló → pillér-scorecard és mátrix → Red Flag részletező → 90 napos akcióterv → ajánlat, beszámítás, módszertan.
Az arculat helykitöltő (`lib/report/brand.ts`), betűkészlet: Inter (SIL OFL, `public/fonts`).

### Bejelentkezés

| Mód | Mikor | AI-végpontok |
|---|---|---|
| `SUPABASE` | `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` beállítva | csak bejelentkezett partner / manager / tanácsadó (ügyfél: 403) |
| `DEMO` | `ALLOW_DEMO_API=1` **és** nem éles build | nyitva (csak fejlesztői gépre) |
| `LOCKED` | minden más eset | zárva (503) |

Belépés: céges Microsoft-fiók (Supabase Azure provider) vagy e-mailes belépési link, csak előre meghívott címre.

1. **Perzisztencia (következő):** `/app/engagements/[id]/risk` route. A `red_flags` betöltése Server Componentben, a mentés debounce-olt Server Actionnel, a `risk_templates` seed a `DEFAULT_CATALOG`-ból.
2. **RLS finomítás (0002):** Storage-policyk a `vdr` bucketre, manager-szerep projekt-szinten, riportkiadási workflow.
3. **AI előszűrés (dokumentumok):** Edge Function, amely a feltöltött PDF-et a Claude API-nak küldi. A CoC-, IP-átruházási és versenytilalmi klauzulák strukturált JSON-ként kerülnek a `documents.ai_extraction` mezőbe, a találatok előjelölt `red_flags` (source = `AI`) sorok lesznek, és a jogász csak jóváhagy.
4. **Riport-verziózás:** a PDF mellé a `reports.snapshot` mentése és partneri kiadás (a PDF-generálás már kész).
5. **Ügyfélportál + emlékeztetők:** `pg_cron` és Edge Function a 2., 5. és 8. napon.
6. **Timesheet + unit economics dashboard** a `v_*_burn` nézetekre.
