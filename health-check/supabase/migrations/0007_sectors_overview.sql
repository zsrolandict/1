-- ════════════════════════════════════════════════════════════════════
-- 0007 – Ágazati katalógus, keresztellenőrzés, AI-összkép
-- ════════════════════════════════════════════════════════════════════

-- Ágazati tételek és kérdések: melyik ágazat(ok)hoz tartoznak (üres = minden ágazat).
alter table risk_templates      add column sectors text[] not null default '{}';
alter table checklist_questions add column sectors text[] not null default '{}';

-- Új források a kockázati tételeknél.
alter table red_flags drop constraint red_flags_source_check;
alter table red_flags add constraint red_flags_source_check
  check (source in ('MANUAL', 'CHECKLIST', 'DATA_TABLE', 'CROSS_CHECK', 'AI', 'AI_DOCUMENT', 'AI_INTERVIEW', 'AI_SYNTHESIS'));

alter type intake_origin add value if not exists 'CROSS_CHECK';
alter type intake_origin add value if not exists 'AI_SYNTHESIS';

-- AI-összkép: több forrásra hivatkozó bizonyíték [{"source_id":"T1","label":"…","quote":"…"}].
alter table intake_suggestions add column evidence_refs jsonb;

-- Az AI-összkép javaslatához legalább egy forrás-idézet kell.
alter table intake_suggestions add constraint synthesis_evidence_required
  check (origin::text <> 'AI_SYNTHESIS' or (evidence_refs is not null and jsonb_array_length(evidence_refs) > 0));
