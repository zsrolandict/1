-- ════════════════════════════════════════════════════════════════════
-- 0008 – Utókövetés: pillanatképek (a red_flags.remediation_status már létezik)
-- ════════════════════════════════════════════════════════════════════
create table assessment_snapshots (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  label         text not null,
  kind          text not null,
  totals        jsonb not null,               -- RiskAssessment.totals
  items         jsonb not null,               -- [{id, code, title, rag, score, expectedLossHuf}]
  created_by    uuid not null references profiles,
  created_at    timestamptz not null default now()
);
create index on assessment_snapshots (engagement_id, created_at desc);
create trigger audit_assessment_snapshots after insert or update or delete on assessment_snapshots for each row execute function audit_row();

alter table assessment_snapshots enable row level security;
create policy snapshots_rw on assessment_snapshots for all
  using (is_staff_member(engagement_id)) with check (is_staff_member(engagement_id));
