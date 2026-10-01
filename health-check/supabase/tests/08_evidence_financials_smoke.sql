-- 0010: bizonyíték-lánc, változásnapló, irattípus, pénzügyi alapadatok
select 'evidence_financials' as t,
  (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name in ('evidence_trail', 'change_log')) as red_flag_columns,
  (select count(*) from pg_constraint where conname = 'red_flags_source_check' and pg_get_constraintdef(oid) like '%FINANCIALS%') as source_has_financials,
  (select count(*) from information_schema.columns where table_name = 'documents' and column_name = 'doc_type') as doc_type,
  (select relrowsecurity from pg_class where relname = 'financial_profiles') as rls_on,
  (select count(*) from pg_policies where tablename = 'financial_profiles') as policies;

do $$
begin
  if (select count(*) from information_schema.columns where table_name = 'red_flags' and column_name in ('evidence_trail', 'change_log')) <> 2 then
    raise exception 'red_flags: hiányzik az evidence_trail / change_log oszlop';
  end if;
  if not (select relrowsecurity from pg_class where relname = 'financial_profiles') then
    raise exception 'financial_profiles: nincs bekapcsolva a sorszintű jogosultság';
  end if;
  begin
    insert into red_flags (engagement_id, pillar, title, likelihood, impact, division, evidence_trail)
      values (gen_random_uuid(), 'FINANCE', 'x', 1, 1, 'TAX', '{"nem":"tömb"}'::jsonb);
    raise exception 'evidence_trail: objektumot is elfogadott';
  exception when check_violation then null;
  end;
end $$;
