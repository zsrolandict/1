-- ════════════════════════════════════════════════════════════════════
-- 0009 – Cégkivonat, tudástár (anonim), óraszám-követés kiegészítés,
--        modulkapcsolók
-- ════════════════════════════════════════════════════════════════════

-- Nyilvános cégadatok: a kivonatból kiolvasott, idézettel igazolt adatok
-- (RegistryRecord). A kivonat szövege a dokumentumtárban marad.
alter table engagements add column registry jsonb;

-- Kikapcsolt modulok projektenként (pl. {'INTERVIEWS','BUYER_QUESTIONS'}).
alter table engagements add column disabled_modules text[] not null default '{}';

-- Óraszám: szerepkör és rövid megjegyzés a bejegyzéshez. A PM-órák a
-- meglévő séma szerint pillar = null sorok.
alter table timesheet_entries add column work_role text
  check (work_role in ('PARTNER', 'SENIOR', 'JUNIOR'));

-- Tudástár: a lezárt projektek ANONIM összesítője. Szándékosan nincs
-- engagement_id, cégnév, összeg vagy bizonyíték; a projekt visszakeresése
-- ebből nem lehetséges. A `ref_hash` csak a kettős felvételt szűri
-- (sha256(engagement_id || titkos só) az alkalmazásban képezve).
create table benchmark_records (
  id            uuid primary key default gen_random_uuid(),
  ref_hash      text not null unique,
  closed_at     date not null,
  kind          text not null,
  sectors       text[] not null default '{}',
  revenue_band  text not null check (revenue_band in ('XS', 'S', 'M', 'L')),
  health_score  int not null check (health_score between 0 and 100),
  red           int not null,
  amber         int not null,
  items         jsonb not null,                -- [{code, pillar, title, likelihood, impact, rag}] – egyedi tételnél code='CUS', title=''
  created_by    uuid not null references profiles,
  created_at    timestamptz not null default now()
);
create index on benchmark_records (kind);
create index on benchmark_records using gin (sectors);
create trigger audit_benchmark_records after insert or update or delete on benchmark_records for each row execute function audit_row();

alter table benchmark_records enable row level security;
-- Minden belső munkatárs olvassa (ügyfél nem); felvenni partner vagy menedzser tud.
create policy benchmark_read on benchmark_records for select using (auth_role() <> 'client');
create policy benchmark_write on benchmark_records for insert with check (auth_role() in ('partner', 'manager'));
create policy benchmark_delete on benchmark_records for delete using (is_partner());
