-- ════════════════════════════════════════════════════════════════════
-- 0005 – Adatgyűjtés: kérdőív-előjelölés, adattáblák, dokumentumelemzés
--   Mindhárom forrás JAVASLATOT ad (intake_suggestions); a red_flags
--   táblába csak szakértői döntés után kerül (decision = ACCEPTED).
--   A nyers táblafájl nem kerül ide (a böngészőben dolgozzuk fel), a
--   dokumentumot a szerver nem tárolja: csak az ellenőrzött eredmény.
-- ════════════════════════════════════════════════════════════════════

-- Új forrás: adattábla.
alter table red_flags drop constraint red_flags_source_check;
alter table red_flags add constraint red_flags_source_check
  check (source in ('MANUAL', 'CHECKLIST', 'DATA_TABLE', 'AI', 'AI_DOCUMENT', 'AI_INTERVIEW'));

-- Kérdőív: rövid tény-címke és feltételes megjelenítés (lib/intake/checklist.ts).
alter table checklist_questions
  add column short_label text,
  add column show_if jsonb,                    -- {"question":"Q01","when":{"equals":false}}
  add column rules jsonb not null default '[]'; -- FlagRule[]; a régi flag_rule/flag_template_code helyett

comment on column checklist_questions.flag_rule is 'ELAVULT (0005): helyette rules (több szabály, típusfüggő kód, képlet-paraméter).';

create type intake_table_kind as enum ('AR_AGING', 'SALES_BY_CUSTOMER', 'PURCHASES_BY_SUPPLIER', 'RELATED_PARTY');

-- Adattábla: csak a számolt mutatók és a fájl azonosítója.
create table intake_tables (
  engagement_id uuid not null references engagements on delete cascade,
  kind          intake_table_kind not null,
  file_name     text not null,
  file_sha256   text not null,                  -- melyik fájlból számoltunk (reprodukálhatóság)
  ref_date      date,
  row_count     integer not null check (row_count >= 0),
  total_huf     bigint not null,
  metrics       jsonb not null,                 -- lib/intake/tables/metrics.ts Metric[]
  created_by    uuid not null references profiles,
  created_at    timestamptz not null default now(),
  primary key (engagement_id, kind)
);

-- Dokumentumelemzés eredménye (documents.ai_extraction mellé, strukturáltan).
alter table documents
  add column ai_model       text,
  add column ai_redactions  jsonb,              -- {"telefon":2,"e-mail":2}
  add column ai_discarded   smallint not null default 0 check (ai_discarded >= 0),
  add column page_labels    text[];

create type intake_origin as enum ('CHECKLIST', 'DATA_TABLE', 'AI_DOCUMENT');

-- Egységes javaslat-sor mindhárom forrásból; a döntés auditált.
create table intake_suggestions (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  origin        intake_origin not null,
  suggestion_key text not null,                 -- lib/intake IntakeSuggestion.key
  pillar        pillar not null,
  template_code text references risk_templates,
  title         text not null,
  likelihood    smallint not null check (likelihood between 1 and 5),
  impact        smallint not null check (impact between 1 and 5),
  valuation_patch jsonb,
  evidence      text not null,
  quote         text,
  document_id   uuid references documents on delete cascade,
  page_label    text,
  confidence    numeric(3,2) check (confidence between 0 and 1),
  decision      finding_decision not null default 'PENDING',
  decided_by    uuid references profiles,
  decided_at    timestamptz,
  red_flag_id   uuid references red_flags on delete set null,
  created_at    timestamptz not null default now(),
  unique (engagement_id, suggestion_key),
  constraint doc_quote_required check (origin <> 'AI_DOCUMENT' or (quote is not null and document_id is not null)),
  constraint intake_decision_audit check (decision = 'PENDING' or (decided_by is not null and decided_at is not null))
);
create index on intake_suggestions (engagement_id, decision);

create trigger audit_intake_tables      after insert or update or delete on intake_tables      for each row execute function audit_row();
create trigger audit_intake_suggestions after insert or update or delete on intake_suggestions for each row execute function audit_row();

-- ── RLS ─────────────────────────────────────────────────────────────
-- Táblamutatók: a projekt tanácsadói. Javaslatok: a pillér szakértője
-- (ugyanúgy, mint a red_flags). Az ügyfél-felhasználó egyiket sem látja.
alter table intake_tables      enable row level security;
alter table intake_suggestions enable row level security;

create policy intake_tables_rw on intake_tables for all
  using (is_staff_member(engagement_id)) with check (is_staff_member(engagement_id));
create policy intake_suggestions_rw on intake_suggestions for all
  using (can_access_pillar(engagement_id, pillar)) with check (can_access_pillar(engagement_id, pillar));
