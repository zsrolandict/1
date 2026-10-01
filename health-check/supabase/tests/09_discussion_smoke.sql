-- 0011: vélemény-szál a kockázati tételeken
select 'discussion' as t,
  (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name = 'discussion') as column_present;

do $$
begin
  if (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name = 'discussion') <> 1 then
    raise exception 'red_flags: hiányzik a discussion oszlop';
  end if;
  begin
    insert into red_flags (engagement_id, pillar, title, likelihood, impact, division, discussion)
      values (gen_random_uuid(), 'FINANCE', 'x', 1, 1, 'TAX', '{"nem":"tömb"}'::jsonb);
    raise exception 'discussion: objektumot is elfogadott';
  exception when check_violation then null;
  end;
end $$;
