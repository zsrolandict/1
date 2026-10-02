-- ════════════════════════════════════════════════════════════════════
-- 0014 – Szerveroldali bizalom (audit K8, K11, K12, K13)
--   1. Meghívásos regisztráció: kéretlen fiók nem jöhet létre (hook + trigger).
--   2. Hiteles napló: a bizonyíték-lánc, a változásnapló és a vélemények
--      csak hozzáfűzhetők; a szerző nevét és az időt az adatbázis írja be
--      (a kliens nem hamisíthatja); AI-felülvizsgálatot csak a szerver
--      (service role) rögzíthet.
--   3. Elosztott hívásszám-korlát: a kulcs a bejelentkezett felhasználó
--      (auth.uid()), nem kliens által küldött érték (X-Forwarded-For).
--   4. Atomikus mentés: tételek, kérdőív-válaszok, munkaterület-adatok és a
--      riportrekord egyetlen tranzakcióban, verziózárral.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Meghívások ────────────────────────────────────────────────────
create table invitations (
  email       citext primary key,
  full_name   text not null,
  role        app_role not null,
  specialty   pillar,
  invited_by  uuid references profiles,
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  constraint invitation_consultant_specialty check (role <> 'consultant' or specialty is not null)
);
alter table invitations enable row level security;
create policy invitations_partner on invitations for all using (is_partner()) with check (is_partner());

-- Supabase Auth „Before User Created” hook: meghívás nélkül nincs regisztráció
-- (a felületi shouldCreateUser: false csak kényelmi; ez a valódi kapu).
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  mail text := lower(coalesce(event #>> '{user,email}', ''));
begin
  if mail <> '' and exists (select 1 from invitations where email = mail and accepted_at is null) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Csak meghívott felhasználó léphet be.'));
end $$;
revoke execute on function public.hook_before_user_created(jsonb) from public;
-- Hostolt Supabase-ben a hookot az Auth szolgáltatás szerepköre hívja.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- Második védvonal (akkor is, ha a hook nincs bekapcsolva): az új auth-felhasználó
-- csak meghívással jöhet létre; a profil a meghívásból készül.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
begin
  select * into inv from invitations where email = lower(coalesce(new.email, '')) and accepted_at is null;
  if not found then
    raise exception 'Csak meghívott felhasználó léphet be (%).', coalesce(new.email, 'e-mail nélkül') using errcode = '42501';
  end if;
  insert into profiles (id, full_name, email, role, specialty)
    values (new.id, inv.full_name, inv.email, inv.role, inv.specialty)
    on conflict (id) do nothing;
  update invitations set accepted_at = now() where email = inv.email;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

-- A szerepkört a felhasználó nem írhatja át magának (csak partner).
create policy profiles_partner_write on profiles for update using (is_partner()) with check (is_partner());

-- ── 2. Hiteles, csak hozzáfűzhető napló ─────────────────────────────
-- A kulcsok összevetése a megengedetten változó mezők nélkül.
create or replace function jsonb_without(j jsonb, keys text[]) returns jsonb language sql immutable as $$
  select coalesce((select jsonb_object_agg(k, v) from jsonb_each(j) e(k, v) where not k = any(keys)), '{}'::jsonb)
$$;

create or replace function guard_red_flag_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  who  text;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  o jsonb; n jsonb; i int; old_len int; new_len int;
  old_trail jsonb; old_log jsonb; old_disc jsonb;
  out_arr jsonb;
begin
  -- Megbízható szerveroldal (service role, migráció, karbantartás): nincs bélyegzés.
  if uid is null then return new; end if;
  select full_name into who from profiles where id = uid;
  old_trail := case when tg_op = 'UPDATE' then old.evidence_trail else '[]'::jsonb end;
  old_log   := case when tg_op = 'UPDATE' then old.change_log     else '[]'::jsonb end;
  old_disc  := case when tg_op = 'UPDATE' then old.discussion     else '[]'::jsonb end;

  -- Bizonyíték-lánc: a régi bejegyzések tartalma változatlan; a bélyegzett mezők
  -- (ki fogadta el, mikor) mindig a tárolt értékek. Az újakat a szerver bélyegzi.
  old_len := jsonb_array_length(old_trail); new_len := jsonb_array_length(new.evidence_trail);
  if new_len < old_len then raise exception 'A bizonyíték-láncból nem lehet törölni.' using errcode = '42501'; end if;
  out_arr := '[]'::jsonb;
  for i in 0 .. new_len - 1 loop
    n := new.evidence_trail -> i;
    if i < old_len then
      o := old_trail -> i;
      if jsonb_without(n, array['acceptedBy', 'at']) is distinct from jsonb_without(o, array['acceptedBy', 'at']) then
        raise exception 'A bizonyíték-lánc korábbi bejegyzése nem módosítható.' using errcode = '42501';
      end if;
      n := o;
    else
      n := n || jsonb_build_object('acceptedBy', who, 'at', now_iso);
    end if;
    out_arr := out_arr || jsonb_build_array(n);
  end loop;
  new.evidence_trail := out_arr;

  -- Változásnapló: hozzáfűzhető; az indoklás egyszer pótolható; az utolsó bejegyzést
  -- ugyanaz a felhasználó 2 percen belül összevonhatja vagy visszavonhatja (gépelés).
  old_len := jsonb_array_length(old_log); new_len := jsonb_array_length(new.change_log);
  if new_len < old_len - 1 then raise exception 'A változásnaplóból nem lehet törölni.' using errcode = '42501'; end if;
  out_arr := '[]'::jsonb;
  for i in 0 .. greatest(new_len, old_len) - 1 loop
    o := old_log -> i; n := new.change_log -> i;
    if o is not null and n is null then
      -- csak az utolsó, saját, indoklás nélküli, friss bejegyzés tűnhet el (visszavont gépelés)
      if not (i = old_len - 1 and o ->> 'by' = who and coalesce(o ->> 'reason', '') = '' and (now() - (o ->> 'at')::timestamptz) < interval '2 minutes') then
        raise exception 'A változásnaplóból nem lehet törölni.' using errcode = '42501';
      end if;
    elsif o is not null then
      if jsonb_without(n, array['reason', 'by', 'at']) is distinct from jsonb_without(o, array['reason', 'by', 'at']) then
        if i = old_len - 1 and o ->> 'by' = who and coalesce(o ->> 'reason', '') = '' and o ->> 'field' = n ->> 'field'
           and (now() - (o ->> 'at')::timestamptz) < interval '2 minutes' then
          n := jsonb_without(n, array['by', 'at']) || jsonb_build_object('by', who, 'at', now_iso);
        else
          raise exception 'A változásnapló korábbi bejegyzése nem módosítható.' using errcode = '42501';
        end if;
      elsif coalesce(o ->> 'reason', '') <> '' then
        if coalesce(n ->> 'reason', '') <> o ->> 'reason' then raise exception 'A már megadott indoklás nem módosítható.' using errcode = '42501'; end if;
        n := o;
      else
        n := jsonb_without(o, array['reason']) || case when coalesce(n ->> 'reason', '') <> '' then jsonb_build_object('reason', n ->> 'reason') else '{}'::jsonb end;
      end if;
      out_arr := out_arr || jsonb_build_array(n);
    else
      out_arr := out_arr || jsonb_build_array(n || jsonb_build_object('by', who, 'at', now_iso));
    end if;
  end loop;
  new.change_log := out_arr;

  -- Vélemények: hozzáfűzhető; AI-bejegyzést csak a szerver ír; a döntés egyszer rögzíthető.
  old_len := jsonb_array_length(old_disc); new_len := jsonb_array_length(new.discussion);
  if new_len < old_len then raise exception 'A vélemények közül nem lehet törölni.' using errcode = '42501'; end if;
  out_arr := '[]'::jsonb;
  for i in 0 .. new_len - 1 loop
    n := new.discussion -> i;
    if i < old_len then
      o := old_disc -> i;
      if jsonb_without(n, array['decision', 'by', 'at']) is distinct from jsonb_without(o, array['decision', 'by', 'at']) then
        raise exception 'Korábbi vélemény nem módosítható.' using errcode = '42501';
      end if;
      if o ? 'decision' then
        if (n -> 'decision' ->> 'kind') is distinct from (o -> 'decision' ->> 'kind') then raise exception 'A döntés már rögzítve van.' using errcode = '42501'; end if;
        n := o;
      elsif n ? 'decision' then
        if n -> 'decision' ->> 'kind' not in ('APPLIED', 'REJECTED') then raise exception 'Ismeretlen döntés.'; end if;
        n := o || jsonb_build_object('decision', jsonb_build_object('kind', n -> 'decision' ->> 'kind', 'by', who, 'at', now_iso));
      else
        n := o;
      end if;
    else
      if n ->> 'role' = 'AI' or n ? 'review' then raise exception 'AI-felülvizsgálatot csak a szerver rögzíthet.' using errcode = '42501'; end if;
      n := jsonb_without(n, array['decision']) || jsonb_build_object('by', who, 'at', now_iso);
    end if;
    out_arr := out_arr || jsonb_build_array(n);
  end loop;
  new.discussion := out_arr;
  return new;
end $$;

create trigger red_flags_guard_history before insert or update on red_flags
  for each row execute function guard_red_flag_history();

-- AI-felülvizsgálat rögzítése: csak a szerver hívhatja (service role), miután a
-- felhasználó jogosultságát a saját (RLS-es) kapcsolatán ellenőrizte.
create or replace function append_ai_review(p_red_flag uuid, p_entry jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_entry ->> 'role' <> 'AI' then raise exception 'Csak AI-bejegyzés rögzíthető így.'; end if;
  update red_flags set discussion = discussion || jsonb_build_array(p_entry || jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
   where id = p_red_flag;
  if not found then raise exception 'Nincs ilyen tétel.'; end if;
end $$;
revoke execute on function append_ai_review(uuid, jsonb) from public;

-- ── 3. Elosztott hívásszám-korlát ───────────────────────────────────
create table rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);
alter table rate_limits enable row level security; -- szabály nincs: közvetlenül senki nem éri el

create or replace function rate_limit_hit(p_kind text, p_max int, p_window_seconds int default 3600)
returns table (ok boolean, retry_after int) language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  win timestamptz;
  n int;
begin
  if uid is null then raise exception 'Bejelentkezés szükséges.' using errcode = '42501'; end if;
  if p_kind !~ '^[a-z_]{1,32}$' or p_max < 1 or p_window_seconds < 1 then raise exception 'Hibás korlát-paraméter.'; end if;
  win := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits as r (bucket, window_start, hits) values (p_kind || ':' || uid, win, 1)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning r.hits into n;
  -- régi ablakok takarítása (olcsó, a saját kulcsra)
  delete from rate_limits where bucket = p_kind || ':' || uid and window_start < win;
  ok := n <= p_max;
  retry_after := case when ok then 0 else ceil(extract(epoch from (win + make_interval(secs => p_window_seconds) - now())))::int end;
  return next;
end $$;

-- ── 4. Atomikus mentés ──────────────────────────────────────────────
alter table red_flags add column item_key text;            -- a felület tételazonosítója
alter table red_flags add column item_code text;           -- katalóguskód (a template_code FK nélkül)
-- A tétel többi, nem hitelesített adata (képlet, indoklás, javítási állapot…). A napló-tömbök
-- (trail/history/discussion) NEM kerülnek ide: azok csak a védett oszlopokban élnek.
alter table red_flags add column item jsonb not null default '{}'::jsonb check (jsonb_typeof(item) = 'object');
create unique index red_flags_item_key on red_flags (engagement_id, item_key);
alter table engagements add column revision int not null default 0;
alter table engagements add column workspace jsonb not null default '{}'::jsonb;  -- cégadatok, lefedettségi felülbírálások, napló

create table engagement_answers (
  engagement_id uuid primary key references engagements on delete cascade,
  answers       jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  request_status jsonb not null default '{}'::jsonb check (jsonb_typeof(request_status) = 'object'),
  updated_by    uuid references profiles,
  updated_at    timestamptz not null default now()
);
alter table engagement_answers enable row level security;
create policy answers_staff on engagement_answers for all
  using (is_partner() or is_staff_member(engagement_id)) with check (is_partner() or is_staff_member(engagement_id));

-- Verziózár és munkaterület-adat: a projekt tagjai (nem ügyfél) és a partner
-- léptethetik; az engagements többi oszlopát továbbra is csak partner írja.
create or replace function touch_engagement(p_engagement uuid, p_expected_revision int, p_workspace jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  cur int;
begin
  if not (is_partner() or is_staff_member(p_engagement)) then
    raise exception 'Nincs ilyen projekt, vagy nincs hozzá jogosultság.' using errcode = '42501';
  end if;
  select revision into cur from engagements where id = p_engagement for update;
  if not found then raise exception 'Nincs ilyen projekt.' using errcode = '42501'; end if;
  if cur <> p_expected_revision then
    raise exception 'Közben valaki más mentett (verzió % ≠ %). Töltsd újra.', cur, p_expected_revision using errcode = '40001';
  end if;
  update engagements set workspace = coalesce(p_workspace, '{}'), revision = revision + 1 where id = p_engagement;
  return cur + 1;
end $$;

/**
 * Egy mentés = egy tranzakció. Bármely hiba (jogosultság, megsértett
 * megkötés, verzióütközés) esetén semmi nem íródik: nincs félkész állapot.
 * A riport-pillanatképet (p_snapshot) a SZERVER számolja a motorral; a
 * kliens csak bemenetet küld. SECURITY INVOKER: minden írásra az RLS érvényes.
 */
create or replace function save_assessment(
  p_engagement uuid,
  p_expected_revision int,
  p_items jsonb,
  p_answers jsonb,
  p_request_status jsonb,
  p_workspace jsonb,
  p_snapshot jsonb
) returns int language plpgsql security invoker set search_path = public as $$
declare
  new_rev int;
  it jsonb;
  keys text[];
  next_version int;
begin
  -- Elsőként a zár és a verzió: ütközésnél semmi más nem fut le.
  new_rev := touch_engagement(p_engagement, p_expected_revision, p_workspace);
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Hibás tétellista.'; end if;

  select coalesce(array_agg(x ->> 'id'), '{}') into keys from jsonb_array_elements(p_items) x;
  delete from red_flags where engagement_id = p_engagement and item_key is not null and not (item_key = any(keys));

  for it in select * from jsonb_array_elements(p_items) loop
    insert into red_flags as r (engagement_id, item_key, item_code, item, pillar, title, description, identified, likelihood, impact,
                                exposure_huf, remediation_days, remediation, division, service_fee_huf, source,
                                evidence_trail, change_log, discussion, remediation_plan, ignore_kind_adjustment)
    values (p_engagement, it ->> 'id', it ->> 'code', it - 'trail' - 'history' - 'discussion', (it ->> 'pillar')::pillar, it ->> 'title', it ->> 'description',
            (it ->> 'identified')::boolean, (it ->> 'likelihood')::int, (it ->> 'impact')::int,
            round((it ->> 'exposureHuf')::numeric)::bigint, round((it ->> 'remediationDays')::numeric)::int, it ->> 'remediation',
            (it ->> 'division')::division, round(coalesce((it ->> 'serviceFeeHuf')::numeric, 0))::bigint, coalesce(it ->> 'source', 'MANUAL'),
            coalesce(it -> 'trail', '[]'), coalesce(it -> 'history', '[]'), coalesce(it -> 'discussion', '[]'),
            coalesce(it -> 'plan', '{}'), coalesce((it ->> 'ignoreKindAdjustment')::boolean, false))
    on conflict (engagement_id, item_key) do update set
      item_code = excluded.item_code, item = excluded.item, pillar = excluded.pillar, title = excluded.title, description = excluded.description,
      identified = excluded.identified, likelihood = excluded.likelihood, impact = excluded.impact,
      exposure_huf = excluded.exposure_huf, remediation_days = excluded.remediation_days, remediation = excluded.remediation,
      division = excluded.division, service_fee_huf = excluded.service_fee_huf, source = excluded.source,
      evidence_trail = excluded.evidence_trail, change_log = excluded.change_log, discussion = excluded.discussion,
      remediation_plan = excluded.remediation_plan, ignore_kind_adjustment = excluded.ignore_kind_adjustment;
  end loop;

  insert into engagement_answers as a (engagement_id, answers, request_status, updated_by, updated_at)
    values (p_engagement, coalesce(p_answers, '{}'), coalesce(p_request_status, '{}'), auth.uid(), now())
    on conflict (engagement_id) do update set answers = excluded.answers, request_status = excluded.request_status,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  select coalesce(max(version), 0) + 1 into next_version from reports where engagement_id = p_engagement;
  insert into reports (engagement_id, version, snapshot, generated_by) values (p_engagement, next_version, p_snapshot, auth.uid());

  return new_rev;
end $$;
