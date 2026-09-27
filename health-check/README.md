# ICT Health Check · Internal Diagnostic & Due Diligence Tool

Belső eszköz az ICT Európa „Vállalati Health Check & Vendor Due Diligence” szolgáltatásához. Célcsoport: 1–5 Mrd Ft árbevételű KKV-k. Négy pilléren (Pénzügy, Jog, Operáció, HR) vizsgál, 10 napos vagy 4 hetes átfutással, 1,2 M Ft + ÁFA belépő áron, ~18–21 szakértői órás keretből.

> A repó gyökerében lévő Vite-alkalmazás (Smart Autodoc) független ettől a projekttől. Ez a könyvtár önálló Next.js alkalmazás.

## Tartalom

| # | Téma | Hol |
|---|---|---|
| 1 | Rendszerarchitektúra és tech stack | [`docs/01-architektura.md`](docs/01-architektura.md) |
| 2 | Adatmodell (Supabase / PostgreSQL DDL, RLS, nézetek) | [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) |
| 3 | UX/UI képernyőterv | [`docs/03-ux-kepernyoterv.md`](docs/03-ux-kepernyoterv.md) |
| 4 | MVP: Interaktív Red Flag Mátrix | [`components/risk/RedFlagMatrix.tsx`](components/risk/RedFlagMatrix.tsx) + [`lib/risk/`](lib/risk) |

## Futtatás

```bash
cd health-check
npm install
npm run dev        # http://localhost:3000
npm test           # kockázati motor unit tesztek (vitest)
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
                -f supabase/tests/01_rls_smoke.sql
```

A füstteszt öt felhasználó nézőpontjából ellenőrzi a láthatóságot: partner mindent lát, HR-szakértő csak HR-dokumentumot és kulcsember-interjút, pénzügyi szakértő csak főkönyvet, ügyfél csak a saját feltöltéseit, idegen ügyfél semmit. Emellett ellenőrzi, hogy a kredit-főkönyv append-only és nem mehet negatívba, és hogy pénzügyi szakértő nem írhat HR red flaget.

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
                  ├─* hour_budgets, timesheet_entries  ──► v_engagement_burn, v_pillar_burn
                  └─* credit_ledger (append-only)      ──► v_credit_balance
```

## Kockázati motor (`lib/risk/engine.ts`)

| Szabály | Érték |
|---|---|
| Pontszám | valószínűség (1–5) × hatás (1–5) |
| RAG | ≥ 15 piros · 8–14 sárga · < 8 zöld; **kitettség ≥ lényegességi küszöb → piros** |
| Valószínűség | 1 → 5% · 2 → 20% · 3 → 40% · 4 → 65% · 5 → 90% |
| Várható veszteség | bruttó kitettség × valószínűség |
| Quick win | nem zöld és ≤ 5 munkanap → 0–30 nap |
| Akcióterv | quick win → 0–30 · piros → 31–60 · sárga → 61–90 · zöld → monitoring |
| Prioritás | 50% pontszám + 50% relatív várható veszteség (+0,15 quick win bónusz) |
| Health Score | pillérenként `100 × Π(1 − 0,6 × pont/25)`, összesítve a 4 pillér átlaga |
| Pipeline | csak sárga és piros tételből lesz lead; a kredit = min(audit díj, remediációs díjak) |

Ugyanez a RAG-logika SQL-ben is megvan: `red_flag_rag(score, exposure, materiality)`.

## Következő lépések (javasolt sorrend)

1. **Perzisztencia:** `/app/engagements/[id]/risk` route. A `red_flags` betöltése Server Componentben, a mentés debounce-olt Server Actionnel, a `risk_templates` seed a `DEFAULT_CATALOG`-ból.
2. **RLS finomítás (0002):** Storage-policyk a `vdr` bucketre, manager-szerep projekt-szinten, riportkiadási workflow.
3. **AI előszűrés:** Edge Function, amely a feltöltött PDF-et a Claude API-nak küldi. A CoC-, IP-átruházási és versenytilalmi klauzulák strukturált JSON-ként kerülnek a `documents.ai_extraction` mezőbe, a találatok előjelölt `red_flags` (source = `AI`) sorok lesznek, és a jogász csak jóváhagy.
4. **PDF export:** `@react-pdf/renderer`, 5 oldal, a `reports.snapshot` alapján (lásd `docs/03-ux-kepernyoterv.md` 3.3).
5. **Ügyfélportál + emlékeztetők:** `pg_cron` és Edge Function a 2., 5. és 8. napon.
6. **Timesheet + unit economics dashboard** a `v_*_burn` nézetekre.
