-- ════════════════════════════════════════════════════════════════════
-- 0010 – Bizonyíték-lánc és változásnapló a kockázati tételeken,
--        irattípus a dokumentumokon, pénzügyi alapadatok
-- ════════════════════════════════════════════════════════════════════

-- Bizonyíték-lánc: minden forrás külön bejegyzés (lib/risk/trail.ts EvidenceEntry):
-- [{id, kind, actor, ref, quote, rationale, effect, confidence, acceptedBy, at, link}]
-- Változásnapló: [{at, by, field, from, to, reduces, reason}]; csökkentésnél indoklás kell.
alter table red_flags add column evidence_trail jsonb not null default '[]'::jsonb;
alter table red_flags add column change_log jsonb not null default '[]'::jsonb;
alter table red_flags add constraint evidence_trail_is_array check (jsonb_typeof(evidence_trail) = 'array');
alter table red_flags add constraint change_log_is_array check (jsonb_typeof(change_log) = 'array');

-- Új forrás: pénzügyi alapadatokból jövő szabály.
alter table red_flags drop constraint red_flags_source_check;
alter table red_flags add constraint red_flags_source_check
  check (source in ('MANUAL', 'CHECKLIST', 'DATA_TABLE', 'CROSS_CHECK', 'AI', 'AI_DOCUMENT', 'AI_INTERVIEW', 'AI_SYNTHESIS', 'FINANCIALS'));
alter type intake_origin add value if not exists 'FINANCIALS';

-- Irattípus (lib/intake/documents/docTypes.ts): ettől függ a célzott keresés,
-- a pénzügyi kiolvasás és az, hogy melyik bekérési tétel lesz „Beérkezett”.
alter table documents add column doc_type text;

-- Pénzügyi alapadatok projektenként (lib/intake/financials/model.ts).
-- years:        [{year, values: {revenue: …}, sources: {revenue: {kind, ref, quote, docId, by, at}}}]
-- facts:        {auditOpinion, goingConcern, taxDebtHuf, …}
-- fact_sources: {auditOpinion: {kind, ref, quote, docId, by, at}, …}
-- rejected:     elvetett kiolvasott értékek kulcsai
create table financial_profiles (
  engagement_id uuid primary key references engagements on delete cascade,
  years         jsonb not null default '[]'::jsonb check (jsonb_typeof(years) = 'array'),
  facts         jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  fact_sources  jsonb not null default '{}'::jsonb check (jsonb_typeof(fact_sources) = 'object'),
  rejected      jsonb not null default '[]'::jsonb check (jsonb_typeof(rejected) = 'array'),
  updated_by    uuid references profiles,
  updated_at    timestamptz not null default now()
);
create trigger audit_financial_profiles after insert or update or delete on financial_profiles for each row execute function audit_row();

alter table financial_profiles enable row level security;
-- A pénzügyi pillérhez hozzáférő munkatárs (partner, menedzser, pénzügyi szakértő) olvassa és írja; ügyfél nem.
create policy financial_profiles_fin on financial_profiles for all
  using (can_access_pillar(engagement_id, 'FINANCE')) with check (can_access_pillar(engagement_id, 'FINANCE'));
