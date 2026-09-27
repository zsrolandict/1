-- ════════════════════════════════════════════════════════════════════
-- ICT Európa · Internal Diagnostic & Due Diligence Tool
-- 0001 – alap adatmodell (Supabase / PostgreSQL 15+)
--
-- Modulok:
--   M1 Client Portal     : companies, engagements, checklist_*, document_*
--   M2 Workspaces        : worksheets, ebitda_adjustments, key_person_*, supplier_*
--   M3 Kockázati motor   : risk_templates, red_flags, reports
--   M4 Unit Economics    : hour_budgets, timesheet_entries (+ nézet)
--   M5 CRM / Remediation : remediation_items, leads, credit_ledger (+ nézet)
--
-- Titoktartás: minden ügyféladat `engagement_id`-hoz kötött, RLS a
-- tagságon (engagement_members) és a szakterületen (specialty) keresztül.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Enumok ──────────────────────────────────────────────────────────
create type app_role        as enum ('partner', 'manager', 'consultant', 'client');
create type pillar          as enum ('FINANCE', 'LEGAL', 'OPERATIONS', 'HR');
create type division        as enum ('LEGAL', 'TAX', 'ACCOUNTING', 'HR', 'ADVISORY');
create type rag             as enum ('GREEN', 'AMBER', 'RED');
create type engagement_tier as enum ('EXPRESS', 'STANDARD', 'VDD');           -- 10 nap / 4 hét / teljes VDD
create type engagement_status as enum (
  'DRAFT', 'ONBOARDING', 'DATA_COLLECTION', 'ANALYSIS', 'REVIEW', 'REPORTED', 'CLOSED'
);
create type doc_category    as enum (
  'GENERAL_LEDGER', 'TRIAL_BALANCE', 'FINANCIAL_STATEMENT', 'TOP_CONTRACT',
  'COMPANY_EXTRACT', 'ARTICLES', 'ORG_RULES_SZMSZ', 'EMPLOYMENT', 'TAX_RETURN', 'OTHER'
);
create type doc_request_status as enum ('REQUESTED', 'UPLOADED', 'ACCEPTED', 'REJECTED', 'WAIVED');
create type action_window   as enum ('D0_30', 'D31_60', 'D61_90', 'BACKLOG');
create type remediation_status as enum ('OPEN', 'IN_PROGRESS', 'DONE', 'ACCEPTED_RISK');
create type lead_stage      as enum ('NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
create type credit_entry_type as enum ('AUDIT_FEE_PAID', 'CREDIT_APPLIED', 'CREDIT_EXPIRED', 'ADJUSTMENT');

-- ── Közös segédek ───────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ════════════════════════════════════════════════════════════════════
-- Felhasználók, ügyfelek, projektek
-- ════════════════════════════════════════════════════════════════════

-- 1:1 az auth.users-szel. A szerepkör globális, a hozzáférés projekt-szintű.
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null,
  email       citext not null unique,
  role        app_role not null default 'client',
  specialty   pillar,                         -- szakértőknél kötelező, lásd check
  hourly_cost_huf integer check (hourly_cost_huf >= 0),  -- önköltség (unit economics)
  created_at  timestamptz not null default now(),
  constraint consultant_has_specialty check (role <> 'consultant' or specialty is not null)
);

create table companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  tax_number      text unique,                 -- 12345678-1-12
  company_reg_no  text unique,                 -- Cg. 01-09-123456
  revenue_huf     bigint check (revenue_huf >= 0),
  headcount       integer check (headcount >= 0),
  industry_teaor  text,
  created_at      timestamptz not null default now()
);

create table engagements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete restrict,
  code            text not null unique,        -- pl. HC-2026-014
  tier            engagement_tier not null default 'EXPRESS',
  status          engagement_status not null default 'DRAFT',
  fee_huf         bigint not null default 1200000 check (fee_huf >= 0),
  hour_budget_total numeric(5,2) not null default 21 check (hour_budget_total > 0),
  materiality_huf bigint not null default 50000000,
  kickoff_date    date,
  due_date        date,
  lead_partner_id uuid references profiles,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger engagements_updated before update on engagements
  for each row execute function set_updated_at();
create index on engagements (company_id);
create index on engagements (status);

-- Ki mit lát: ügyfél-felhasználók és tanácsadók projektenként.
create table engagement_members (
  engagement_id uuid not null references engagements on delete cascade,
  user_id       uuid not null references profiles on delete cascade,
  member_role   app_role not null,               -- a projektben betöltött szerep
  pillar        pillar,                          -- szakértő: melyik munkalap az övé
  added_at      timestamptz not null default now(),
  primary key (engagement_id, user_id)
);
create index on engagement_members (user_id);

-- ════════════════════════════════════════════════════════════════════
-- M1 · Client Portal – 30 pontos csekklista + VDR light
-- ════════════════════════════════════════════════════════════════════

create table checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  version    integer not null default 1,
  is_active  boolean not null default true,
  unique (name, version)
);

create table checklist_questions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references checklist_templates on delete cascade,
  position     smallint not null,
  pillar       pillar not null,
  question     text not null,
  help_text    text,
  answer_type  text not null check (answer_type in ('YES_NO', 'SCALE_1_5', 'NUMBER', 'TEXT', 'CHOICE')),
  choices      jsonb,
  -- Automatikus red flag: ha a válasz illeszkedik, a hozzárendelt sablon előjelölődik.
  flag_rule    jsonb,                          -- pl. {"equals": false} / {"gte": 40}
  flag_template_code text,
  requires_document doc_category,
  unique (template_id, position)
);

create table checklist_responses (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  question_id   uuid not null references checklist_questions on delete restrict,
  answer        jsonb,                          -- {"value": true} / {"value": 42}
  comment       text,
  answered_by   uuid references profiles,
  answered_at   timestamptz not null default now(),
  unique (engagement_id, question_id)
);

-- Hiánypótlási lista: mit kértünk be, határidővel.
create table document_requests (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  category      doc_category not null,
  title         text not null,                  -- pl. "Top 5 vevői szerződés #2"
  pillar        pillar not null,
  status        doc_request_status not null default 'REQUESTED',
  due_date      date,
  last_reminder_at timestamptz,
  reminder_count smallint not null default 0,
  rejection_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger document_requests_updated before update on document_requests
  for each row execute function set_updated_at();
create index on document_requests (engagement_id, status);

-- A fájl a Supabase Storage privát bucketjében: vdr/{engagement_id}/{uuid}
-- Titkosítás: Storage at-rest AES-256 + opcionális kliens oldali envelope (kms_key_ref).
create table documents (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  request_id    uuid references document_requests on delete set null,
  category      doc_category not null,
  pillar        pillar not null,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  sha256        text not null,
  kms_key_ref   text,
  -- AI előszűrés (Claude API) eredménye: záradékok, hiányzó IP klauzula stb.
  ai_extraction jsonb,
  ai_status     text not null default 'PENDING' check (ai_status in ('PENDING', 'DONE', 'FAILED', 'SKIPPED')),
  uploaded_by   uuid not null references profiles,
  uploaded_at   timestamptz not null default now()
);
create index on documents (engagement_id, category);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid references engagements on delete cascade,
  recipient_id  uuid not null references profiles on delete cascade,
  kind          text not null,                  -- DOC_MISSING, DOC_REJECTED, REPORT_READY …
  payload       jsonb not null default '{}',
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on notifications (recipient_id, read_at);

-- ════════════════════════════════════════════════════════════════════
-- M2 · Szakterületi munkalapok
-- ════════════════════════════════════════════════════════════════════

-- Egy munkalap pillérenként; a strukturálatlan pontozás jsonb-ben, a
-- számításhoz szükséges tételek saját táblában (auditálhatóság).
create table worksheets (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  pillar        pillar not null,
  owner_id      uuid references profiles,
  data          jsonb not null default '{}',     -- ellenőrzőlisták, pontszámok
  score         smallint check (score between 0 and 100),
  submitted_at  timestamptz,
  reviewed_by   uuid references profiles,
  reviewed_at   timestamptz,
  updated_at    timestamptz not null default now(),
  unique (engagement_id, pillar)
);
create trigger worksheets_updated before update on worksheets
  for each row execute function set_updated_at();

-- Pénzügy: normalizált EBITDA híd.
create table ebitda_adjustments (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  fiscal_year   smallint not null,
  label         text not null,                   -- "Tulajdonosi gépjármű", "Egyszeri peres bevétel"
  category      text not null check (category in ('OWNER_COST', 'ONE_OFF', 'RELATED_PARTY', 'RECLASS', 'PRO_FORMA')),
  amount_huf    bigint not null,                 -- + növeli, − csökkenti az EBITDA-t
  evidence_doc_id uuid references documents on delete set null,
  created_by    uuid references profiles,
  created_at    timestamptz not null default now()
);
create index on ebitda_adjustments (engagement_id, fiscal_year);

create table related_party_transactions (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  fiscal_year   smallint not null,
  counterparty  text not null,
  nature        text not null,                   -- szolgáltatás, kölcsön, jogdíj …
  amount_huf    bigint not null,
  has_tp_documentation boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Operáció: beszállítói koncentráció.
create table supplier_exposures (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  supplier_name text not null,
  spend_huf     bigint not null check (spend_huf >= 0),
  is_critical   boolean not null default false,
  has_framework_contract boolean not null default false,
  alt_suppliers smallint not null default 0
);

-- HR 361: kulcsember-függőség.
create table key_person_assessments (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  person_alias  text not null,                   -- pszeudonim, nem név (GDPR)
  position      text not null,
  revenue_dependency_pct numeric(5,2) check (revenue_dependency_pct between 0 and 100),
  knowledge_concentration smallint check (knowledge_concentration between 1 and 5),
  successor_readiness     smallint check (successor_readiness between 1 and 5),
  flight_risk             smallint check (flight_risk between 1 and 5),
  has_non_compete boolean not null default false,
  has_retention   boolean not null default false,
  interview_notes text,                          -- csak HR szakértő + partner (RLS)
  created_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- M3 · Kockázati motor & Red Flag riport
-- ════════════════════════════════════════════════════════════════════

create table risk_templates (
  code          text primary key,                -- FIN-01, LEG-02 …
  pillar        pillar not null,
  title         text not null,
  description   text not null,
  default_likelihood smallint not null check (default_likelihood between 1 and 5),
  default_impact     smallint not null check (default_impact between 1 and 5),
  remediation   text not null,
  division      division not null,
  default_fee_huf bigint not null default 0,
  is_active     boolean not null default true
);

create table red_flags (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  template_code text references risk_templates,  -- null = egyedi tétel
  pillar        pillar not null,
  title         text not null,
  description   text,
  identified    boolean not null default false,
  likelihood    smallint not null check (likelihood between 1 and 5),
  impact        smallint not null check (impact between 1 and 5),
  exposure_huf  bigint not null default 0 check (exposure_huf >= 0),
  remediation_days smallint not null default 5 check (remediation_days >= 0),
  remediation   text,
  division      division not null,
  service_fee_huf bigint not null default 0 check (service_fee_huf >= 0),
  -- Tárolt számított mezők (riport, szűrés, rendezés az adatbázisban):
  score         smallint generated always as (likelihood * impact) stored,
  source        text not null default 'MANUAL' check (source in ('MANUAL', 'CHECKLIST', 'AI')),
  evidence_doc_id uuid references documents on delete set null,
  created_by    uuid references profiles,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (engagement_id, template_code)
);
create trigger red_flags_updated before update on red_flags
  for each row execute function set_updated_at();
create index on red_flags (engagement_id, pillar) where identified;

-- RAG a lényegességi küszöbbel együtt – ugyanaz a logika, mint lib/risk/engine.ts
create or replace function red_flag_rag(score int, exposure bigint, materiality bigint)
returns rag language sql immutable as $$
  select case
    when exposure >= materiality or score >= 15 then 'RED'::rag
    when score >= 8 then 'AMBER'::rag
    else 'GREEN'::rag
  end
$$;

-- Generált riportok (PDF a Storage-ban, pillanatkép jsonb-ben a verziózáshoz).
create table reports (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  version       integer not null,
  snapshot      jsonb not null,                  -- RiskAssessment objektum
  pdf_path      text,
  generated_by  uuid references profiles,
  generated_at  timestamptz not null default now(),
  released_to_client_at timestamptz,             -- partner jóváhagyás után
  unique (engagement_id, version)
);

-- ════════════════════════════════════════════════════════════════════
-- M4 · Unit Economics & Timesheet
-- ════════════════════════════════════════════════════════════════════

-- 18–21 órás keret szétosztása pilléreken (pl. FIN 7, LEG 6, OPS 3, HR 3, PM 2).
create table hour_budgets (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  pillar        pillar,                          -- null = projektmenedzsment / partner review
  budget_hours  numeric(5,2) not null check (budget_hours >= 0),
  -- pillérenként egy sor; a null (PM) sor is csak egyszer (PG15+)
  unique nulls not distinct (engagement_id, pillar)
);

create table timesheet_entries (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  user_id       uuid not null references profiles,
  pillar        pillar,
  work_date     date not null default current_date,
  hours         numeric(4,2) not null check (hours > 0 and hours <= 12),
  activity      text not null,
  created_at    timestamptz not null default now()
);
create index on timesheet_entries (engagement_id, pillar);

create view v_engagement_burn with (security_invoker = true) as
select
  e.id  as engagement_id,
  e.code,
  e.fee_huf,
  e.hour_budget_total,
  coalesce(sum(t.hours), 0)                                         as hours_used,
  round(coalesce(sum(t.hours), 0) / e.hour_budget_total * 100, 1)   as burn_pct,
  coalesce(sum(t.hours * p.hourly_cost_huf), 0)::bigint             as cost_huf,
  e.fee_huf - coalesce(sum(t.hours * p.hourly_cost_huf), 0)::bigint as margin_huf
from engagements e
left join timesheet_entries t on t.engagement_id = e.id
left join profiles p on p.id = t.user_id
group by e.id;

create view v_pillar_burn with (security_invoker = true) as
select
  b.engagement_id,
  b.pillar,
  b.budget_hours,
  coalesce(sum(t.hours), 0) as hours_used,
  case when b.budget_hours = 0 then null
       else round(coalesce(sum(t.hours), 0) / b.budget_hours * 100, 1) end as burn_pct
from hour_budgets b
left join timesheet_entries t
  on t.engagement_id = b.engagement_id
 and t.pillar is not distinct from b.pillar
group by b.engagement_id, b.pillar, b.budget_hours;

-- ════════════════════════════════════════════════════════════════════
-- M5 · Remediation & keresztértékesítés, kredit
-- ════════════════════════════════════════════════════════════════════

create table remediation_items (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  red_flag_id   uuid not null unique references red_flags on delete cascade,
  title         text not null,
  action_window action_window not null,
  owner_side    text not null default 'CLIENT' check (owner_side in ('CLIENT', 'ICT')),
  assignee_id   uuid references profiles,
  due_date      date,
  status        remediation_status not null default 'OPEN',
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger remediation_items_updated before update on remediation_items
  for each row execute function set_updated_at();

create table leads (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  company_id    uuid not null references companies,
  remediation_id uuid references remediation_items on delete set null,
  division      division not null,
  service       text not null,                   -- "Szerződés-átírás", "Transzferár", "BVKK alapítás", "Könyvelés-átvétel"
  est_fee_huf   bigint not null default 0 check (est_fee_huf >= 0),
  stage         lead_stage not null default 'NEW',
  owner_id      uuid references profiles,
  won_fee_huf   bigint check (won_fee_huf >= 0),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger leads_updated before update on leads
  for each row execute function set_updated_at();
create index on leads (division, stage);

-- Append-only főkönyv a 100%-os beszámításhoz: + befizetés, − felhasználás.
create table credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies,
  engagement_id uuid not null references engagements,
  lead_id       uuid references leads,
  entry_type    credit_entry_type not null,
  amount_huf    bigint not null,                 -- előjeles
  valid_until   date,                            -- pl. riport + 12 hónap
  note          text,
  created_by    uuid references profiles,
  created_at    timestamptz not null default now(),
  constraint sign_matches_type check (
    (entry_type = 'AUDIT_FEE_PAID' and amount_huf > 0) or
    (entry_type in ('CREDIT_APPLIED', 'CREDIT_EXPIRED') and amount_huf < 0) or
    entry_type = 'ADJUSTMENT'
  )
);
create index on credit_ledger (engagement_id);

-- Egyenleg nem mehet negatívba (versenyhelyzet ellen engagement-szintű zár).
create or replace function credit_ledger_guard() returns trigger language plpgsql as $$
declare bal bigint;
begin
  perform pg_advisory_xact_lock(hashtext(new.engagement_id::text));
  select coalesce(sum(amount_huf), 0) into bal from credit_ledger where engagement_id = new.engagement_id;
  if bal + new.amount_huf < 0 then
    raise exception 'Credit balance would become negative (% + %)', bal, new.amount_huf;
  end if;
  return new;
end $$;
create trigger credit_ledger_guard before insert on credit_ledger
  for each row execute function credit_ledger_guard();

create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger credit_ledger_immutable before update or delete on credit_ledger
  for each row execute function forbid_mutation();

create view v_credit_balance with (security_invoker = true) as
select
  engagement_id,
  company_id,
  sum(amount_huf) filter (where entry_type = 'AUDIT_FEE_PAID')      as credited_huf,
  -sum(amount_huf) filter (where entry_type = 'CREDIT_APPLIED')     as applied_huf,
  sum(amount_huf)                                                   as balance_huf,
  min(valid_until) filter (where entry_type = 'AUDIT_FEE_PAID')     as valid_until
from credit_ledger
group by engagement_id, company_id;

-- ════════════════════════════════════════════════════════════════════
-- Audit napló (ügyvédi titok: ki mit nézett / módosított)
-- ════════════════════════════════════════════════════════════════════

create table audit_log (
  id            bigint generated always as identity primary key,
  engagement_id uuid,
  actor_id      uuid,
  table_name    text not null,
  row_id        uuid,
  action        text not null,                   -- INSERT / UPDATE / DELETE / DOWNLOAD
  diff          jsonb,
  at            timestamptz not null default now()
);
create index on audit_log (engagement_id, at desc);

create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit_log (engagement_id, actor_id, table_name, row_id, action, diff)
  values (
    (rec->>'engagement_id')::uuid,
    auth.uid(),
    tg_table_name,
    (rec->>'id')::uuid,
    tg_op,
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else rec end
  );
  return coalesce(new, old);
end $$;

create trigger audit_red_flags     after insert or update or delete on red_flags     for each row execute function audit_row();
create trigger audit_documents     after insert or update or delete on documents     for each row execute function audit_row();
create trigger audit_key_person    after insert or update or delete on key_person_assessments for each row execute function audit_row();
create trigger audit_reports       after insert or update or delete on reports       for each row execute function audit_row();

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security – alapszabályok
-- (a részletes, pillérenkénti mátrix a 0002-es migráció tárgya)
-- ════════════════════════════════════════════════════════════════════

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_partner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'partner', false)
$$;

create or replace function is_member(eng uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from engagement_members where engagement_id = eng and user_id = auth.uid())
$$;

create or replace function is_staff_member(eng uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from engagement_members
    where engagement_id = eng and user_id = auth.uid() and member_role <> 'client'
  )
$$;

-- Szakértő: csak a saját pilléréhez; manager/partner: mindenhez.
create or replace function can_access_pillar(eng uuid, p pillar) returns boolean
language sql stable security definer set search_path = public as $$
  select is_partner() or exists (
    select 1 from engagement_members
    where engagement_id = eng and user_id = auth.uid()
      and (member_role = 'manager' or (member_role = 'consultant' and pillar = p))
  )
$$;

alter table profiles              enable row level security;
alter table companies             enable row level security;
alter table engagements           enable row level security;
alter table engagement_members    enable row level security;
alter table checklist_templates   enable row level security;
alter table checklist_questions   enable row level security;
alter table checklist_responses   enable row level security;
alter table document_requests     enable row level security;
alter table documents             enable row level security;
alter table notifications         enable row level security;
alter table worksheets            enable row level security;
alter table ebitda_adjustments    enable row level security;
alter table related_party_transactions enable row level security;
alter table supplier_exposures    enable row level security;
alter table key_person_assessments enable row level security;
alter table risk_templates        enable row level security;
alter table red_flags             enable row level security;
alter table reports               enable row level security;
alter table hour_budgets          enable row level security;
alter table timesheet_entries     enable row level security;
alter table remediation_items     enable row level security;
alter table leads                 enable row level security;
alter table credit_ledger         enable row level security;
alter table audit_log             enable row level security;

-- Profil: saját + projekttársak neve látható.
create policy profiles_self on profiles for select using (
  id = auth.uid() or is_partner() or exists (
    select 1 from engagement_members a join engagement_members b using (engagement_id)
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);

create policy companies_read on companies for select using (
  is_partner() or exists (select 1 from engagements e where e.company_id = companies.id and is_member(e.id))
);
create policy companies_partner_write on companies for all using (is_partner()) with check (is_partner());

create policy engagements_read on engagements for select using (is_partner() or is_member(id));
create policy engagements_partner_write on engagements for all using (is_partner()) with check (is_partner());

create policy members_read on engagement_members for select using (is_partner() or is_member(engagement_id));
create policy members_partner_write on engagement_members for all using (is_partner()) with check (is_partner());

-- Sablonok: minden bejelentkezett olvassa, csak partner írja.
create policy checklist_tpl_read on checklist_templates for select using (auth.uid() is not null);
create policy checklist_q_read   on checklist_questions for select using (auth.uid() is not null);
create policy risk_tpl_read      on risk_templates      for select using (auth_role() <> 'client');
create policy checklist_tpl_w on checklist_templates for all using (is_partner()) with check (is_partner());
create policy checklist_q_w   on checklist_questions for all using (is_partner()) with check (is_partner());
create policy risk_tpl_w      on risk_templates      for all using (is_partner()) with check (is_partner());

-- Ügyfél: kitölti a csekklistát és feltölt; tanácsadó olvas.
create policy responses_rw on checklist_responses for all
  using (is_partner() or is_member(engagement_id))
  with check (is_partner() or is_member(engagement_id));

create policy doc_requests_read  on document_requests for select using (is_partner() or is_member(engagement_id));
create policy doc_requests_write on document_requests for all
  using (is_partner() or is_staff_member(engagement_id))
  with check (is_partner() or is_staff_member(engagement_id));

-- Dokumentum: ügyfél a saját projektjén feltölt és látja a sajátjait;
-- szakértő csak a saját pillére dokumentumait (pl. HR ≠ főkönyv).
create policy documents_client_read on documents for select using (
  is_member(engagement_id) and auth_role() = 'client' and uploaded_by = auth.uid()
);
create policy documents_staff_read on documents for select using (can_access_pillar(engagement_id, pillar));
create policy documents_client_insert on documents for insert with check (
  is_member(engagement_id) and uploaded_by = auth.uid()
);

create policy notifications_own on notifications for select using (recipient_id = auth.uid());
create policy notifications_mark_read on notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Pilléres munkaterületek.
create policy worksheets_pillar on worksheets for all
  using (can_access_pillar(engagement_id, pillar)) with check (can_access_pillar(engagement_id, pillar));
create policy ebitda_fin on ebitda_adjustments for all
  using (can_access_pillar(engagement_id, 'FINANCE')) with check (can_access_pillar(engagement_id, 'FINANCE'));
create policy rpt_fin on related_party_transactions for all
  using (can_access_pillar(engagement_id, 'FINANCE')) with check (can_access_pillar(engagement_id, 'FINANCE'));
create policy suppliers_ops on supplier_exposures for all
  using (can_access_pillar(engagement_id, 'OPERATIONS')) with check (can_access_pillar(engagement_id, 'OPERATIONS'));
create policy keyperson_hr on key_person_assessments for all
  using (can_access_pillar(engagement_id, 'HR')) with check (can_access_pillar(engagement_id, 'HR'));

-- Red flag: a szakértő a saját pillérét írja, a projekt minden tanácsadója
-- olvassa (integrált kép); ügyfél nem lát nyers kockázatot, csak kiadott riportot.
create policy red_flags_read  on red_flags for select using (is_partner() or is_staff_member(engagement_id));
create policy red_flags_write on red_flags for all
  using (can_access_pillar(engagement_id, pillar)) with check (can_access_pillar(engagement_id, pillar));

create policy reports_staff  on reports for select using (is_partner() or is_staff_member(engagement_id));
create policy reports_client on reports for select using (is_member(engagement_id) and released_to_client_at is not null);
create policy reports_write  on reports for insert with check (is_partner() or is_staff_member(engagement_id));
create policy reports_release on reports for update using (is_partner()) with check (is_partner());

create policy budgets_read  on hour_budgets for select using (is_partner() or is_staff_member(engagement_id));
create policy budgets_write on hour_budgets for all using (is_partner()) with check (is_partner());

create policy timesheet_read on timesheet_entries for select using (
  user_id = auth.uid() or is_partner() or (is_staff_member(engagement_id) and auth_role() = 'manager')
);
create policy timesheet_own_write on timesheet_entries for insert with check (
  user_id = auth.uid() and is_staff_member(engagement_id)
);
create policy timesheet_own_update on timesheet_entries for update
  using (user_id = auth.uid() and work_date >= current_date - 7)
  with check (user_id = auth.uid());

create policy remediation_read on remediation_items for select using (is_partner() or is_member(engagement_id));
create policy remediation_staff_write on remediation_items for all
  using (is_partner() or is_staff_member(engagement_id)) with check (is_partner() or is_staff_member(engagement_id));

-- CRM: csak belső munkatársak.
create policy leads_staff on leads for all
  using (is_partner() or is_staff_member(engagement_id)) with check (is_partner() or is_staff_member(engagement_id));

create policy credit_read on credit_ledger for select using (is_partner() or is_member(engagement_id));
create policy credit_partner_insert on credit_ledger for insert with check (is_partner());

create policy audit_partner on audit_log for select using (is_partner());
