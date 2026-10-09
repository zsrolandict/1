-- 0015 · Szerveres projekttárolás: a felület a projekteket az adatbázisból
-- tölti és oda menti (a böngésző csak gyorsítótár).
--  1. Projekt létrehozása a felületről (partner, manager) – cég, projekt és tagság egy lépésben.
--  2. Moduladatok (adatgyűjtés, utókövetési pillanatképek) projektenként.
--  3. save_assessment: a moduladatok is ugyanabban a tranzakcióban; a változatlan
--     tétel nem íródik újra (pillér-tanácsadó a teljes listát küldheti); a szerver
--     által közben hozzáfűzött vélemények (AI-felülvizsgálat) nem vesznek el;
--     az értékelés-pillanatkép a projekten (nem minden mentés új riportverzió).

-- ── 1. Projekt létrehozása ──────────────────────────────────────────
create or replace function create_engagement(p_company_name text, p_kind engagement_kind, p_materiality bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r app_role;
  cid uuid;
  eid uuid;
begin
  select role into r from profiles where id = uid;
  if uid is null or r is null or r not in ('partner', 'manager') then
    raise exception 'Projektet partner vagy projektvezető hozhat létre.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_company_name), '') = '' or length(p_company_name) > 300 then
    raise exception 'Hibás cégnév.' using errcode = '22023';
  end if;
  if p_materiality is null or p_materiality < 0 then
    raise exception 'Hibás lényegességi küszöb.' using errcode = '22023';
  end if;
  insert into companies (name) values (btrim(p_company_name)) returning id into cid;
  insert into engagements (company_id, code, kind, materiality_huf, lead_partner_id)
    values (cid, 'HC-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
            p_kind, p_materiality, case when r = 'partner' then uid end)
    returning id into eid;
  insert into engagement_members (engagement_id, user_id, member_role) values (eid, uid, r);
  return eid;
end $$;
revoke execute on function create_engagement(text, engagement_kind, bigint) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function create_engagement(text, engagement_kind, bigint) to authenticated;
  end if;
end $$;

-- ── 2. Moduladatok ──────────────────────────────────────────────────
create table engagement_modules (
  engagement_id uuid not null references engagements on delete cascade,
  module        text not null check (module in ('intake', 'snapshots')),
  data          jsonb not null,
  updated_by    uuid references profiles,
  updated_at    timestamptz not null default now(),
  primary key (engagement_id, module),
  -- Felső korlát (a böngészős tárhely nagyságrendje): túlméretes adat nem kerülhet be.
  constraint module_size check (pg_column_size(data) <= 8 * 1024 * 1024)
);
alter table engagement_modules enable row level security;
create policy modules_staff on engagement_modules for all
  using (is_partner() or is_staff_member(engagement_id)) with check (is_partner() or is_staff_member(engagement_id));

-- Az utolsó mentés szerveren számolt értékelése (a projektlista és a riport forrása).
alter table engagements add column snapshot jsonb;

-- ── 3. Atomikus mentés, moduladatokkal ──────────────────────────────
drop function if exists save_assessment(uuid, int, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function save_assessment(
  p_engagement uuid,
  p_expected_revision int,
  p_items jsonb,
  p_answers jsonb,
  p_request_status jsonb,
  p_workspace jsonb,
  p_snapshot jsonb,
  p_modules jsonb default '{}'::jsonb
) returns int language plpgsql security invoker set search_path = public as $$
declare
  new_rev int;
  it jsonb;
  keys text[];
  cur red_flags;
  disc jsonb;
  m record;
begin
  -- Elsőként a zár és a verzió: ütközésnél semmi más nem fut le.
  new_rev := touch_engagement(p_engagement, p_expected_revision, p_workspace);
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Hibás tétellista.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_modules, '{}')) <> 'object' then raise exception 'Hibás moduladat.' using errcode = '22023'; end if;

  select coalesce(array_agg(x ->> 'id'), '{}') into keys from jsonb_array_elements(p_items) x;
  delete from red_flags where engagement_id = p_engagement and item_key is not null and not (item_key = any(keys));

  for it in select * from jsonb_array_elements(p_items) loop
    select * into cur from red_flags where engagement_id = p_engagement and item_key = it ->> 'id';
    -- A szerver közben hozzáfűzhetett véleményt (AI-felülvizsgálat): a kliens régebbi
    -- listáját a tárolt többlettel egészítjük ki (törölni úgysem lehet).
    disc := coalesce(it -> 'discussion', '[]');
    if found and jsonb_array_length(cur.discussion) > jsonb_array_length(disc) then
      disc := disc || coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(cur.discussion) with ordinality t(e, o)
                                where o > jsonb_array_length(disc)), '[]');
    end if;
    -- Változatlan tétel: nincs írás (így a pillér-tanácsadó a teljes listát küldheti).
    if found and (cur.item_code, cur.item, cur.pillar::text, cur.title, cur.description, cur.identified, cur.likelihood, cur.impact,
                  cur.exposure_huf, cur.remediation_days, cur.remediation, cur.division::text, cur.service_fee_huf, cur.source,
                  cur.evidence_trail, cur.change_log, cur.discussion, cur.remediation_plan, cur.ignore_kind_adjustment)
       is not distinct from
                 (it ->> 'code', it - 'trail' - 'history' - 'discussion', it ->> 'pillar', it ->> 'title', it ->> 'description',
                  (it ->> 'identified')::boolean, (it ->> 'likelihood')::int, (it ->> 'impact')::int,
                  round((it ->> 'exposureHuf')::numeric)::bigint, round((it ->> 'remediationDays')::numeric)::int, it ->> 'remediation',
                  it ->> 'division', round(coalesce((it ->> 'serviceFeeHuf')::numeric, 0))::bigint, coalesce(it ->> 'source', 'MANUAL'),
                  coalesce(it -> 'trail', '[]'), coalesce(it -> 'history', '[]'), disc,
                  coalesce(it -> 'plan', '{}'), coalesce((it ->> 'ignoreKindAdjustment')::boolean, false)) then
      continue;
    end if;
    -- Meglévő tételnél UPDATE (nem INSERT … ON CONFLICT): a BEFORE INSERT trigger a
    -- javasolt sorra is lefutna, és a tárolt naplót újként kezelné.
    if found then
      update red_flags set
        item_code = it ->> 'code', item = it - 'trail' - 'history' - 'discussion', pillar = (it ->> 'pillar')::pillar,
        title = it ->> 'title', description = it ->> 'description', identified = (it ->> 'identified')::boolean,
        likelihood = (it ->> 'likelihood')::int, impact = (it ->> 'impact')::int,
        exposure_huf = round((it ->> 'exposureHuf')::numeric)::bigint, remediation_days = round((it ->> 'remediationDays')::numeric)::int,
        remediation = it ->> 'remediation', division = (it ->> 'division')::division,
        service_fee_huf = round(coalesce((it ->> 'serviceFeeHuf')::numeric, 0))::bigint, source = coalesce(it ->> 'source', 'MANUAL'),
        evidence_trail = coalesce(it -> 'trail', '[]'), change_log = coalesce(it -> 'history', '[]'), discussion = disc,
        remediation_plan = coalesce(it -> 'plan', '{}'), ignore_kind_adjustment = coalesce((it ->> 'ignoreKindAdjustment')::boolean, false)
      where id = cur.id;
    else
      insert into red_flags (engagement_id, item_key, item_code, item, pillar, title, description, identified, likelihood, impact,
                             exposure_huf, remediation_days, remediation, division, service_fee_huf, source,
                             evidence_trail, change_log, discussion, remediation_plan, ignore_kind_adjustment)
      values (p_engagement, it ->> 'id', it ->> 'code', it - 'trail' - 'history' - 'discussion', (it ->> 'pillar')::pillar, it ->> 'title', it ->> 'description',
              (it ->> 'identified')::boolean, (it ->> 'likelihood')::int, (it ->> 'impact')::int,
              round((it ->> 'exposureHuf')::numeric)::bigint, round((it ->> 'remediationDays')::numeric)::int, it ->> 'remediation',
              (it ->> 'division')::division, round(coalesce((it ->> 'serviceFeeHuf')::numeric, 0))::bigint, coalesce(it ->> 'source', 'MANUAL'),
              coalesce(it -> 'trail', '[]'), coalesce(it -> 'history', '[]'), disc,
              coalesce(it -> 'plan', '{}'), coalesce((it ->> 'ignoreKindAdjustment')::boolean, false));
    end if;
  end loop;

  insert into engagement_answers as a (engagement_id, answers, request_status, updated_by, updated_at)
    values (p_engagement, coalesce(p_answers, '{}'), coalesce(p_request_status, '{}'), auth.uid(), now())
    on conflict (engagement_id) do update set answers = excluded.answers, request_status = excluded.request_status,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at
    where (a.answers, a.request_status) is distinct from (excluded.answers, excluded.request_status);

  for m in select key, value from jsonb_each(coalesce(p_modules, '{}')) loop
    insert into engagement_modules as em (engagement_id, module, data, updated_by, updated_at)
      values (p_engagement, m.key, m.value, auth.uid(), now())
      on conflict (engagement_id, module) do update set data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      where em.data is distinct from excluded.data;
  end loop;

  -- A pillanatkép a projekten: security definer nélkül csak partner írhatna, ezért a
  -- touch_engagement mintájára külön függvény (ugyanaz a jogosultság-ellenőrzés).
  perform set_engagement_snapshot(p_engagement, p_snapshot);
  return new_rev;
end $$;

create or replace function set_engagement_snapshot(p_engagement uuid, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_partner() or is_staff_member(p_engagement)) then
    raise exception 'Nincs ilyen projekt, vagy nincs hozzá jogosultság.' using errcode = '42501';
  end if;
  update engagements set snapshot = p_snapshot where id = p_engagement;
end $$;
