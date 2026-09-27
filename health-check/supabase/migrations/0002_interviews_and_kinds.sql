-- ════════════════════════════════════════════════════════════════════
-- 0002 – Átvilágítás-típusok + Interjúmodul
--   * engagements.kind: Health Check, VDD, buy-side DD, finanszírozás,
--     utódlás, megfelelőség, integráció – ugyanaz a motor, más hangsúly
--   * interviews / interview_questions / interview_transcripts / interview_findings
--   * hozzájárulás nélkül nem tárolható felvétel, a hang automatikusan törlődik
-- ════════════════════════════════════════════════════════════════════

create type engagement_kind as enum (
  'HEALTH_CHECK', 'VENDOR_DD', 'BUY_SIDE_DD', 'FINANCING_READINESS',
  'SUCCESSION', 'COMPLIANCE_AUDIT', 'POST_MERGER'
);
alter table engagements add column kind engagement_kind not null default 'HEALTH_CHECK';

-- Katalógustételek típusonkénti relevanciája (üres = minden típusnál).
alter table risk_templates add column kinds engagement_kind[] not null default '{}';

-- Red flag forrása bővül az interjúval és a dokumentum-AI-val.
alter table red_flags drop constraint red_flags_source_check;
alter table red_flags add constraint red_flags_source_check
  check (source in ('MANUAL', 'CHECKLIST', 'AI', 'AI_DOCUMENT', 'AI_INTERVIEW'));

create type interviewee_role as enum (
  'OWNER_CEO', 'CFO', 'HR_LEAD', 'OPS_LEAD', 'SALES_LEAD', 'IT_LEAD', 'KEY_PERSON'
);
create type interview_status as enum ('PLANNED', 'HELD', 'TRANSCRIBED', 'ANALYZED', 'REVIEWED');

create table interviews (
  id              uuid primary key default gen_random_uuid(),
  engagement_id   uuid not null references engagements on delete cascade,
  role            interviewee_role not null,
  -- Pszeudonim (GDPR): a valódi név csak az ügyfélnyilvántartásban.
  interviewee_alias text not null,
  -- A legérzékenyebb pillér szabja meg, ki láthatja (HR 361 → csak HR + partner).
  pillar          pillar not null,
  confidential    boolean not null default false,
  interviewer_id  uuid references profiles,
  scheduled_at    timestamptz,
  held_at         timestamptz,
  status          interview_status not null default 'PLANNED',
  -- Hozzájárulás a felvételhez és az AI-feldolgozáshoz.
  consent_at      timestamptz,
  consent_recorded_by uuid references profiles,
  consent_note    text,
  -- Hangfájl (Storage: interviews/{engagement}/{id}); csak a leirat ellenőrzéséig él.
  recording_path  text,
  recording_delete_after timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint recording_requires_consent check (recording_path is null or consent_at is not null),
  constraint recording_has_expiry check (recording_path is null or recording_delete_after is not null)
);
create trigger interviews_updated before update on interviews
  for each row execute function set_updated_at();
create index on interviews (engagement_id);

-- Az interjúhoz generált vezérfonal (szabályalapú + AI), és hogy mi hangzott el.
create table interview_questions (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews on delete cascade,
  position      smallint not null,
  pillar        pillar not null,
  text          text not null,
  listen_for    text,
  follow_ups    text[] not null default '{}',
  source        jsonb not null,              -- {"type":"RED_FLAG","code":"LEG-01"} …
  priority      smallint not null check (priority between 1 and 3),
  asked         boolean not null default false,
  answer_note   text,
  unique (interview_id, position)
);

create table interview_transcripts (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews on delete cascade,
  version       integer not null default 1,
  origin        text not null check (origin in ('AUDIO', 'NOTES')),
  provider      text,                        -- "Azure AI Speech" / null (jegyzet)
  language      text not null default 'hu-HU',
  duration_ms   integer,
  timed         boolean not null,
  segments      jsonb not null,              -- [{speaker,startMs,endMs,text}]
  speaker_map   jsonb not null default '{}', -- {"Beszélő 1":"Ügyvezető"}
  reviewed_by   uuid references profiles,    -- a félrehallásokat ember javította
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (interview_id, version)
);

create type finding_kind as enum ('STATEMENT', 'SUGGESTED_FLAG', 'CONTRADICTION', 'FOLLOW_UP');
create type finding_decision as enum ('PENDING', 'ACCEPTED', 'REJECTED');

-- Az AI-elemzés tételei külön sorokban: mindegyikről a szakértő dönt, auditálhatóan.
create table interview_findings (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews on delete cascade,
  transcript_id uuid not null references interview_transcripts on delete cascade,
  kind          finding_kind not null,
  pillar        pillar,
  payload       jsonb not null,              -- a lib/interview/types.ts megfelelő alakja
  quote         text,
  quote_start_ms integer,
  template_code text references risk_templates,
  conflicting_fact text,                     -- dokumentum-hivatkozás ellentmondásnál
  model         text,                        -- pl. claude-opus-5 (reprodukálhatóság)
  decision      finding_decision not null default 'PENDING',
  decided_by    uuid references profiles,
  decided_at    timestamptz,
  red_flag_id   uuid references red_flags on delete set null,
  created_at    timestamptz not null default now(),
  constraint evidence_required check (kind = 'FOLLOW_UP' or quote is not null),
  constraint decision_audit check (decision = 'PENDING' or (decided_by is not null and decided_at is not null))
);
create index on interview_findings (interview_id, kind);

create trigger audit_interviews   after insert or update or delete on interviews   for each row execute function audit_row();
create trigger audit_int_findings after insert or update or delete on interview_findings for each row execute function audit_row();

-- ── RLS ─────────────────────────────────────────────────────────────
-- Interjú: a projekt tanácsadói látják, kivéve a bizalmas (pl. HR 361)
-- interjúkat – azokat csak a pillér szakértője és a partner/manager.
-- Az ügyfél-felhasználó interjút nem lát.

create or replace function can_access_interview(i uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from interviews iv
    where iv.id = i
      and (
        can_access_pillar(iv.engagement_id, iv.pillar)
        or (not iv.confidential and is_staff_member(iv.engagement_id))
      )
  )
$$;

alter table interviews            enable row level security;
alter table interview_questions   enable row level security;
alter table interview_transcripts enable row level security;
alter table interview_findings    enable row level security;

create policy interviews_read on interviews for select using (can_access_interview(id));
create policy interviews_write on interviews for insert with check (can_access_pillar(engagement_id, pillar));
create policy interviews_update on interviews for update
  using (can_access_pillar(engagement_id, pillar)) with check (can_access_pillar(engagement_id, pillar));

create policy iq_rw on interview_questions for all
  using (can_access_interview(interview_id)) with check (can_access_interview(interview_id));
create policy it_rw on interview_transcripts for all
  using (can_access_interview(interview_id)) with check (can_access_interview(interview_id));
create policy if_rw on interview_findings for all
  using (can_access_interview(interview_id)) with check (can_access_interview(interview_id));

-- ── Hangfájlok automatikus törlése ─────────────────────────────────
-- Supabase-en pg_cron + Edge Function törli a Storage-objektumot, majd:
--   select cron.schedule('purge-recordings', '17 3 * * *', $$
--     update interviews set recording_path = null
--     where recording_path is not null and recording_delete_after < now()
--   $$);
