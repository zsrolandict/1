-- ════════════════════════════════════════════════════════════════════
-- 0011 – Szakértői vélemények és AI-felülvizsgálat a kockázati tételeken
-- ════════════════════════════════════════════════════════════════════

-- Vélemény-szál (lib/risk/review.ts DiscussionEntry):
-- [{id, at, by, role: EXPERT|AI, text, review?: {verdict, reasoning, counterpoints,
--   evidenceNeeded, proposal, citations, discarded, basis}, decision?: {kind: APPLIED|REJECTED, by, at}}]
-- A javaslat átvétele a change_log-ba is bekerül (indoklással); a szál önmagában nem módosít értéket.
alter table red_flags add column discussion jsonb not null default '[]'::jsonb;
alter table red_flags add constraint discussion_is_array check (jsonb_typeof(discussion) = 'array');
