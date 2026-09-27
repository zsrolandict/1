# 1. Rendszerarchitektúra és tech stack

## Tervezési elvek

| Elv | Mit jelent a gyakorlatban |
|---|---|
| **Titoktartás a DB-ben, nem az UI-ban** | Minden jogosultság Postgres Row Level Security-vel érvényesül. Ha egy React-komponens hibázik, akkor sem jut ki adat. |
| **Egy számítási mag** | A kockázati motor (`lib/risk/engine.ts`) tiszta TypeScript: ugyanez fut a böngészőben (azonnali visszajelzés), a szerveren (PDF export) és egy SQL-tükörben (`red_flag_rag()`). A riport így nem térhet el a képernyőtől. |
| **Moduláris monolit** | Egy Next.js alkalmazás, egy Postgres. 1 fős fejlesztőcsapat és néhány tucat projekt/év mellett a mikroszolgáltatás csak költség. A modulhatárok mappák és sémák, nem hálózati hívások. |
| **Óraszám a KPI** | Minden képernyő azt szolgálja, hogy a 18–21 óra tartható legyen: előre kitöltött sablonok, AI előszűrés, 1-kattintásos riport. |

## Javasolt stack

| Réteg | Választás | Miért |
|---|---|---|
| Frontend + BFF | **Next.js 16 App Router**, React Server Components, Server Actions | Egy kódbázis a portálnak és a belső felületnek; a szerveroldali renderelés miatt az érzékeny adat nem kerül fölöslegesen a kliensre. |
| UI | **Tailwind CSS 4 + shadcn/ui + lucide-react** | Gyors prototípus, saját kódként birtokolt komponensek (nincs vendor lock-in), ICT arculatra tokenekkel testreszabható. |
| Táblák / űrlapok | TanStack Table, React Hook Form + **Zod** | A Zod séma a kliensen és a Server Actionben is validál. |
| Adatbázis | **Supabase PostgreSQL 15+** | RLS, generált oszlopok, nézetek, triggerek; EU régió (Frankfurt). |
| Auth | Supabase Auth: tanácsadóknak **Azure AD / Entra ID SSO**, ügyfeleknek magic link + TOTP MFA | A belső felhasználók a céges fiókkal lépnek be, az ügyfélnek nem kell jelszó. |
| Fájlok (VDR light) | Supabase Storage privát bucket, `vdr/{engagement_id}/…`, rövid lejáratú signed URL-ek | Az objektumokon is RLS van; a letöltés auditálva. |
| Háttérfeladatok | Supabase Edge Functions + `pg_cron` | Hiánypótlási emlékeztetők, AI előszűrés, riportgenerálás. |
| AI | **Claude API** (dokumentum előszűrés: CoC, IP-átruházás, versenytilalom) | PDF közvetlenül küldhető; strukturált JSON kimenet a `documents.ai_extraction` mezőbe. |
| PDF | `@react-pdf/renderer` (szerveroldalon) vagy Playwright HTML→PDF | Az 5 oldalas vezetői összefoglaló ugyanazokból a React-komponensekből készül. |
| E-mail | Resend / Postmark (EU) | Emlékeztetők, „riport kész” értesítés. |
| Megfigyelhetőség | Sentry (PII-szűrés), Supabase log drain | |
| Hosting | Vercel (fra1) vagy on-prem Docker + self-hosted Supabase | Ha a kamarai / ügyfél-elvárás on-premet kér, a stack változatlanul átvihető. |

## Logikai architektúra

```
┌──────────────────────── Next.js (App Router) ────────────────────────┐
│  /portal/*            Ügyfél: csekklista, VDR feltöltés, státusz     │
│  /app/engagements/*   Tanácsadó: munkalapok, Red Flag mátrix, riport │
│  /app/pipeline        Partner: CRM, kredit, unit economics           │
│                                                                      │
│  Server Actions ──► lib/risk/engine.ts  (közös számítási mag)        │
│                ──► lib/pdf/*           (riport)                      │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ supabase-js (user JWT → RLS)  │ service role CSAK
                ▼                               ▼ Edge Functionben
┌───────────────────────── Supabase (EU) ──────────────────────────────┐
│ Postgres + RLS │ Storage (vdr bucket) │ Auth (SSO, magic link, MFA)  │
│ pg_cron ──► Edge Fn: reminders │ ai-prescreen (Claude) │ render-pdf  │
└──────────────────────────────────────────────────────────────────────┘
```

## Modul → séma → képernyő leképezés

| Modul | Táblák | Fő útvonal |
|---|---|---|
| M1 Client Portal | `checklist_*`, `document_requests`, `documents`, `notifications` | `/portal/[engagement]` |
| M2 Workspaces | `worksheets`, `ebitda_adjustments`, `related_party_transactions`, `supplier_exposures`, `key_person_assessments` | `/app/engagements/[id]/[pillar]` |
| M3 Kockázati motor | `risk_templates`, `red_flags`, `reports`, `red_flag_rag()` | `/app/engagements/[id]/risk`, `/report` |
| M4 Unit Economics | `hour_budgets`, `timesheet_entries`, `v_engagement_burn`, `v_pillar_burn` | globális időmérő + `/app/engagements/[id]/time` |
| M5 CRM | `remediation_items`, `leads`, `credit_ledger`, `v_credit_balance` | `/app/pipeline` |

## Biztonság és titoktartás

- **Szerepkörök:** `partner` (mindent lát), `manager` (a saját projektjeit teljesen), `consultant` (csak a saját pillérét: `can_access_pillar()`), `client` (csak a saját projektjét, csak a saját feltöltéseit és a már *kiadott* riportot).
- **A service role kulcs** kizárólag Edge Functionökben él, soha nem a Next.js kliensben.
- **Kulcsember-interjúk:** pszeudonimizált (`person_alias`), csak HR-szakértő és partner látja.
- **Audit napló:** triggerek a `red_flags`, `documents`, `key_person_assessments`, `reports` táblákon; a letöltéseket a signed URL-t kiadó Server Action naplózza.
- **Megőrzés:** a projekt lezárása után *N* hónappal (megbízási szerződés szerint) `pg_cron` törli a Storage-objektumokat, a riport-pillanatkép megmarad.
- **Kredit-főkönyv:** append-only (a trigger tiltja az UPDATE-et és a DELETE-et), negatív egyenleg nem lehetséges (advisory lock + ellenőrzés).

## Unit economics logika

- `engagements.hour_budget_total` (alapból 21), pillérenkénti bontás a `hour_budgets` táblában (pl. FIN 7 · LEG 6 · OPS 3 · HR 3 · PM 2).
- `v_pillar_burn.burn_pct`: 80% felett sárga figyelmeztetés a munkalap fejlécében, 100% felett a további időrögzítéshez manager-jóváhagyás kell.
- `v_engagement_burn.margin_huf = fee − Σ(óra × önköltség)`: a partner dashboardon projektenként látszik.
