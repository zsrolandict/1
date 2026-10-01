-- ════════════════════════════════════════════════════════════════════
-- 0012 – Javítási terv a kockázati tételeken
-- ════════════════════════════════════════════════════════════════════

-- A díjat a javítási terv adja (lib/remediation): sablon szerinti munkalépések
-- × az üzletág óradíja, a terjedelemtől függő sávval. Itt csak a tételre szabott
-- pontosítás tárolódik (lib/remediation/types.ts PlanOverride):
-- {driver?: szám, hours?: {"<lépés sorszáma>": óra}, feeOverrideHuf?: Ft, note?: szöveg}
-- A service_fee_huf régi, egyösszegű díj: csak sablon nélküli tételnél él tovább kézi díjként.
alter table red_flags add column remediation_plan jsonb not null default '{}'::jsonb;
alter table red_flags add constraint remediation_plan_is_object check (jsonb_typeof(remediation_plan) = 'object');
comment on column red_flags.service_fee_huf is 'Régi egyösszegű díj; a díjat a remediation_plan + óradíjtábla adja.';
