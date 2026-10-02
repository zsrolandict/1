# 12 · Élesítés: biztonsági bekötés (audit K8–K13, K19)

Ez a dokumentum az éles bekötés **kódban kész** részét és a **kézzel elvégzendő**
(Supabase-, Azure- és hosting-beállítási) lépéseket írja le. A kódbeli védelmek
tesztekkel ellenőrzöttek (`supabase/tests/12_server_trust_smoke.sql`,
`lib/server/server.test.ts`, `e2e/next-smoke.mjs`); a lenti beállítások nélkül
viszont az éles rendszer **nem** tekinthető lezártnak.

## 1. Mi van kész a kódban

| Audit | Védelem | Hol |
|---|---|---|
| K13 | **Atomikus mentés:** tételek, kérdőív-válaszok, iratállapot, munkaterület és riport-pillanatkép EGY tranzakcióban (`save_assessment`). Verzióütközés (`40001` → HTTP 409), jogosultsági hiba (`42501` → 403) vagy érvénytelen adat (→ 400) esetén semmi nem íródik. | `0014_server_trust.sql`, `app/api/engagements/[id]/save/route.ts` |
| K13 | **Szerveroldali értékelés:** a kliens csak bemenetet küld; a pontszámot, besorolást, lefedettséget és díjat a szerver számolja. Kliens által küldött `score`, `rag`, `fee` stb. eldobva. | `lib/server/saveAssessment.ts` |
| K8 | **Hamisíthatatlan napló:** a bizonyíték-lánc, a változásnapló és a vita csak bővülhet (append-only); a szerzőt (`by`, `acceptedBy`) és az időt (`at`) az adatbázis bélyegzi a munkamenetből. Bejelentkezett felhasználó nem írhat AI-bejegyzést; AI-bejegyzést csak a szerver (service role) rögzít. | `guard_red_flag_history`, `append_ai_review` |
| K9 | **AI-kérés az adatbázisból:** éles módban a felülvizsgálat csak a tétel azonosítóját és a véleményt fogadja; a tételt, a forrásokat és a levezetést a szerver az RLS-en át olvassa. Kitalált forrás nem kerülhet a modell elé. | `app/api/risk/review/route.ts`, `lib/server/reviewFromDb.ts` |
| K10 | **Sütik:** a Supabase-munkamenet HttpOnly, élesben Secure, SameSite=Lax. A böngésző a sütit nem olvassa; a nevet a `/api/me`, a kilépést a `/auth/signout` (POST, Origin-ellenőrzéssel, minden eszközön) végzi. A munkamenetet a `proxy.ts` frissíti. | `lib/auth/cookies.ts`, `proxy.ts` |
| K12 | **Kéretlen regisztráció tiltva, három rétegben:** (1) Auth-hook (`hook_before_user_created`) – meghívás nélkül a Supabase el sem küldi a belépő linket; (2) adatbázis-trigger az `auth.users`-en – meghívás nélkül a felhasználó nem jöhet létre, a profil a meghívásból készül; (3) a visszatérési útvonal profil és engedélyezett domain (`ALLOWED_EMAIL_DOMAINS`) nélkül kilépteti. Szerepkört csak partner módosíthat. | `0014`, `app/auth/callback/route.ts` |
| K12 | **Adatelkülönítés:** projekt-tagság és pillér-jogosultság RLS-sel (meglévő); a mentés pillér-szinten is ellenőriz, és jogosulatlan tételnél az egész mentés elmarad. | `0001`–`0014` |
| K11 | **Elosztott hívásszám-korlát** az adatbázisban (`rate_limit_hit`), a kulcs a munkamenet felhasználója (`auth.uid()`), nem IP – X-Forwarded-For hamisítással és több szerverpéldánnyal sem kerülhető meg. Ha a korlát nem ellenőrizhető, a végpont zárva marad (503). | `lib/auth/rateLimit.ts` |
| K19 | **Fejlécek:** CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, élesben **HSTS** (2 év, aldomainek, preload). | `next.config.ts` |

## 2. Kézi beállítások (sorrendben)

### 2.1 Supabase – adatbázis és hálózat (K19)

1. **Migrációk:** `supabase db push` (0001–0014), előtte teszt-projekten. Utána:
   `select count(*) from invitations;` legalább a partner(ek) meghívása legyen benne (lásd 2.4).
2. **5432-es port lezárása:** *Project Settings › Database › Network Restrictions* –
   csak a hosting kimenő IP-címei (és szükség esetén az üzemeltető fix IP-je).
   CLI-vel: `supabase network-restrictions update --db-allow-cidr <IP>/32 --experimental`.
   Az alkalmazás a közvetlen 5432-es kapcsolatot nem használja (HTTPS-en, a
   Supabase API-n át ír és olvas), így a szűkítés a működést nem érinti.
3. **SSL kikényszerítése:** *Database › SSL Configuration › Enforce SSL on incoming connections* bekapcsolva.
4. **Adatbázis-jelszó:** erős, egyedi, jelszókezelőben; a pooler (6543) is ugyanezzel védett.
5. **PITR / mentés** bekapcsolva (08-as dokumentum, „Élesítés”).

### 2.2 Supabase – hitelesítés (K10, K12)

1. *Authentication › Sign In / Providers*: **„Allow new users to sign up” KIKAPCSOLVA**;
   e-mail-link csak meghívottnak.
2. *Authentication › Hooks › Before User Created*: **Postgres-függvény:
   `public.hook_before_user_created`** – bekapcsolva. (A 0014 megadja hozzá a
   végrehajtási jogot az Auth szolgáltatásnak.)
3. *Authentication › URL Configuration*: Site URL = éles cím; Redirect URLs csak
   `https://<éles-cím>/auth/callback` (és a preview-cím, ha van).
4. *Authentication › Sessions*: munkamenet-időkorlát (javaslat: 12 óra inaktivitás),
   „Single session per user” igény szerint.
5. Rate limit (Auth): az e-mail-küldés korlátja maradjon alacsony (alapérték).

### 2.3 Microsoft (Azure) belépés

1. Entra ID › App registrations: **Single tenant** („Accounts in this organizational directory only”).
2. Redirect URI: `https://<projekt>.supabase.co/auth/v1/callback`.
3. Supabase *Providers › Azure*: Client ID, secret, **Azure Tenant URL**
   (`https://login.microsoftonline.com/<tenant-id>`) – így más szervezet fiókja nem léphet be.
4. A secret lejárati idejét naptárba; csere a 08-as „Kulcscsere” szerint.

### 2.4 Felhasználók meghívása

Csak partner (vagy a Supabase SQL-szerkesztő) vehet fel meghívást:

```sql
insert into invitations (email, full_name, role, specialty)
values ('nev@iroda.hu', 'Teszt Elek', 'consultant', 'LEGAL');
```

Az első belépéskor a profil a meghívásból készül, a meghívás „elfogadott” lesz.
Meghívás nélküli e-mail címmel a belépés minden úton elutasul. A meghívás
visszavonása: a sor törlése (még belépés előtt); belépett felhasználónál a
szerepkör módosítása vagy a felhasználó tiltása a Supabase-ben.

### 2.5 Hosting – környezeti változók

| Változó | Érték | Megjegyzés |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a projektből | nyilvános, az RLS véd |
| `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings › API › service_role* | **csak szerveren**, soha nem `NEXT_PUBLIC_`; csak az AI-felülvizsgálat rögzítése használja. Hiányában az a végpont 503-at ad. |
| `ALLOWED_EMAIL_DOMAINS` | pl. `iroda.hu,csoport.hu` | üresen minden meghívott domain engedett |
| `AI_DPA_CONFIRMED` | `1` csak DPA után | lásd 08 |

HTTPS kötelező (a HSTS-fejléc és a Secure süti ezt feltételezi).

## 3. Ellenőrzés élesítés után

- `curl -sI https://<éles-cím>/ | grep -i strict-transport` → `max-age=63072000; includeSubDomains; preload`.
- Böngésző fejlesztői eszköz › Application › Cookies: az `sb-…` sütik **HttpOnly** és **Secure**.
- Meghívás nélküli e-mail címmel belépő link kérése → hibaüzenet, levél nem megy ki.
- `psql "postgres://…@db.<projekt>.supabase.co:5432/postgres"` a hostingon kívüli gépről → időtúllépés / elutasítás.
- Ügyfél-szerepkörrel az AI- és a mentés-végpont 403.

## 4. Korlátok – ami még NINCS kész

- **A felület még a böngészőben tárol** (localStorage). A szerveres mentés-végpont és
  az adatbázis-oldali felülvizsgálat kész és tesztelt, de a felület tárolórétegének
  átállítása (projektek betöltése/mentése a szerverről) a következő lépés. Addig éles
  módban a felülvizsgálat és a mentés csak az adatbázisban már meglévő projekttel működik.
- **Egy szervezet:** az elkülönítés projekt-tagság és pillér szerinti; külön
  szervezetek (`org_id`) kezelése nincs. Több cég (bérlő) kiszolgálásához ez bővítendő.
- **Pillér-tanácsadó mentése:** ha a mentett listában más pillér tétele is van, az egész
  mentés elutasul (atomikusan). A felület átállításakor a pillér-szűrt mentést kell küldeni.
- A Supabase- és Azure-beállítások (2. fejezet) kézi lépések; a kód ezeket nem tudja kikényszeríteni.
