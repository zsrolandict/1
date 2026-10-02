# 08 · Üzemeltetés: fejlesztés, ellenőrzés, élesítés, visszaállítás

Ez a leírás annak szól, aki a programot fejleszti, élesíti vagy üzemelteti. A felhasználói működés a `RENDSZERLEIRAS.md`-ben és a `docs/07`-ben van.

## Napi parancsok (`health-check/` mappában)

| Parancs | Mit csinál |
|---|---|
| `npm run dev` | Fejlesztői szerver (http://localhost:3000). AI csak `.env.local` kulcsokkal. |
| `npm run check` | Típusellenőrzés + lint + unit tesztek – commit előtt. |
| `npm run format` | Prettier-formázás (a CI csak ellenőrzi: `format:check`). |
| `npm run build` | Éles build. |
| `npm run e2e` | Előnézet-build + böngészős füstteszt (15 lépés, szerver és AI-kulcs nélkül). Helyi Chromiummal: `CHROMIUM_PATH=/út/chrome npm run e2e`. |
| `npm run build && npm run e2e:next` | A Next-alkalmazás füsttesztje éles buildön: oldalak, biztonsági fejlécek (CSP), belépés-visszairányítás, `?projekt=`, hidratálási és CSP-hibák. |
| `npm run db:sync` | A típuskorrekciós SQL-seed és a besorolás-paritásteszt újragenerálása a TypeScript forrásból; változásnál új migrációt ír. |
| `bash scripts/db-smoke.sh` | Az összes migráció + jogosultsági füsttesztek egy **üres** PostgreSQL-adatbázison (a `PG*` környezeti változók szerint). |
| `npm run build:preview:publish` | Kattintható előnézet (claude.ai Artifact) közzétehető fájlokra bontva: `dist-preview/publish/` (index.html, app.js, app.css, fonts). |

## Automatikus ellenőrzés (CI)

A `.github/workflows/health-check-ci.yml` minden pushnál és PR-nál (ha a `health-check/` változott) három feladatot futtat:

1. **check** – típusok, lint, formázás, unit tesztek, build.
2. **database** – PostgreSQL 16-on a `scripts/db-smoke.sh`. Új migrációt a szkript listájába is fel kell venni; ha kimarad, a szkript hibát ad.
3. **e2e** – az előnézet-build böngészős füsttesztje (`e2e/smoke.mjs`), majd a Next-alkalmazásé éles buildön (`e2e/next-smoke.mjs`).

**Lint-szabályok:** a Next.js ajánlott szabályai. A React Compiler négy szabálya (`set-state-in-effect`, `refs`, `purity`, `preserve-manual-memoization`) átmenetileg csak figyelmeztet: a munkaterületek mount után a böngészős tárolóból töltenek. A közös `useWorkspace` hook (technikai adósság, 2. szakasz) után ezek visszaállnak hibára.

## Környezeti változók

A teljes lista magyarázattal: `.env.example`. Éles környezetben kötelező:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (EU régió);
- `SUPABASE_SERVICE_ROLE_KEY` – csak szerveren; `ALLOWED_EMAIL_DOMAINS` – céges domainek;
- `AI_PROVIDER` + `ANTHROPIC_API_KEY` vagy `GEMINI_API_KEY` – **fizetős, DPA-val**;
- `AI_DPA_CONFIRMED=1` – csak a DPA aláírása után; enélkül éles módban minden AI-funkció zárva;
- leirathoz: `TRANSCRIBE_PROVIDER` (+ Azure esetén `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`).

Tilos élesben: `ALLOW_DEMO_API`. Kulcs soha nem kerül a repóba (`.env*.local` a `.gitignore`-ban).

## Élesítés

1. A CI zöld a kiadandó commiton.
2. **Adatbázis-mentés** (Supabase: Database › Backups; PITR legyen bekapcsolva).
3. Új migrációk futtatása sorrendben (`supabase db push`), előtte egy teszt-projekten.
   Első élesítéskor a Supabase/Azure biztonsági beállításai (5432 lezárása, SSL,
   regisztráció tiltása, Auth-hook, single tenant): **docs/12-elesites-biztonsag.md**.
4. Előnézeti (preview) deploy a hostingon, **külön teszt Supabase-projekttel**; füstteszt kézzel: belépés, új projekt, javaslat elfogadása, PDF és Excel, mentés fájlba és visszatöltés, ügyfél-szerepkörrel az AI 403.
5. Éles deploy, 15 percig a naplók figyelése (`[api]` hibák, 5xx, szolgáltatói 429).

## Visszaállítás

| Helyzet | Teendő |
|---|---|
| Hibás kiadás, adat rendben | A hostingon az előző deploymentet visszaemelni élesnek (pl. Vercel: „Promote to Production”). |
| Hibás migráció | Supabase PITR az élesítés előtti időpontra; utána az előző kiadás. A migrációk eddig csak bővítenek (nincs adatmódosító lépés). |
| AI-szolgáltató gond, túlköltés vagy adatkezelési kérdés | **AI-vészkapcsoló:** az `AI_DPA_CONFIRMED` törlése + újraindítás. Minden AI-hívás azonnal zárva, a program többi része működik. |
| Ügyfél belső adatot lát | Azonnali visszaállás, incidens, a jogosultsági szabályok (RLS) és a `01_rls_smoke.sql` ellenőrzése. |

## Kulcscsere

1. Új kulcs a szolgáltatónál (Anthropic Console / Google AI Studio / Azure).
2. A hosting környezeti változójának cseréje, újraindítás.
3. A régi kulcs visszavonása a szolgáltatónál.
4. Ha egy kulcs nyilvánosságra került (pl. nyilvános repóba): azonnal visszavonni, a git-történetből nem elég törölni.

## Monitoring (strukturált napló)

A szerver minden fontos eseményt egy JSON-sorként ír a standard kimenetre (`lib/monitoring.ts`); tartalmat, személyes adatot, kulcsot nem:

| `event` | Mikor | Riasztási javaslat |
|---|---|---|
| `ai_call` (`provider`, `ok`, `ms`, `error`) | minden AI-hívás | `ok=false` arány 1 órán át > 10%; `ms` medián > 60 000 |
| `api_error` (`status`, `kind`) | minden API-hibaválasz | 5xx > 2% 15 percen át |
| `ai_rate_limited` (`kind`) | valaki elérte az óránkénti korlátot | szokatlan gyakoriság (visszaélés vagy túl szigorú korlát) |
| `ai_blocked_policy` | éles módban DPA-megerősítés nélküli AI-kérés | bármely előfordulás (beállítási hiba) |

A naplót a hosting gyűjti (pl. Vercel Log Drains, Fly.io log shipping); a riasztás ott állítható. Külső hibakövetőhöz (pl. Sentry EU) a `setMonitoringSink` ad bekötési pontot.

## Hibakeresés

- A szerver minden API-hibát `[api]` előtaggal naplóz; a felhasználó csak a szándékosan neki szánt magyar üzenetet kapja (`UserFacingError`), minden más esetben általános üzenetet.
- `GET /api/interviews/status`: mely szolgáltatások élnek (AI, leirat), és milyen hitelesítési módban fut a szerver.
- 429 a saját API-tól: a felhasználónkénti óránkénti korlát (`AI_RATE_LIMIT_PER_HOUR`, `TRANSCRIBE_RATE_LIMIT_PER_HOUR`); szerverpéldányonként számol.

## Felület: design-alap

- Színek és betű egy helyen: `app/theme.css` (Tailwind `@theme`: `brand-*` kék, `navy-*` oldalsáv, `canvas` háttér, Inter). A Next-alkalmazás és az előnézet is ezt tölti be.
- Keret: `components/shell/AppShell.tsx` (sötét oldalsáv + felső sáv a projektválasztóval), logó: `components/ui/BrandMark.tsx`, favicon: `public/icon.svg`.
- Közös elemek: `components/ui/primitives.tsx` (kártya, KPI-csempe, jelvény, gombstílusok), `components/ui/StepBar.tsx` (a projekt szakaszai, `lib/projectStages.ts`).
- Oldalfejléc, fülsor, legördülő: `PageHeader`, `TabBar`/`TabButton`, `SELECT`; a projekt szakaszai minden oldal tetején: `components/ui/ProjectStagesCard.tsx`. Új oldal ezekből épüljön, ne saját színekből.
