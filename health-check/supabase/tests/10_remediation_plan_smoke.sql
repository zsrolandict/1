-- 0012: javítási terv a kockázati tételeken
select 'remediation_plan' as t,
  (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name = 'remediation_plan') as column_present;

do $$
begin
  if (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name = 'remediation_plan') <> 1 then
    raise exception 'red_flags: hiányzik a remediation_plan oszlop';
  end if;
  begin
    insert into red_flags (engagement_id, pillar, title, likelihood, impact, division, remediation_plan)
      values (gen_random_uuid(), 'FINANCE', 'x', 1, 1, 'TAX', '[]'::jsonb);
    raise exception 'remediation_plan: tömböt is elfogadott';
  exception when check_violation then null;
  end;
end $$;
