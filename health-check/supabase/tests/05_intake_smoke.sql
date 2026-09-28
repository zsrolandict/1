-- 0005: új forrás, javaslat-szabályok (a sémaszintű ellenőrzések)
select 'intake' as t,
  (select count(*) from pg_constraint where conname = 'red_flags_source_check'
     and pg_get_constraintdef(oid) like '%DATA_TABLE%') as source_has_data_table,
  (select count(*) from information_schema.columns where table_name = 'intake_suggestions') > 15 as suggestions_table,
  (select relrowsecurity from pg_class where relname = 'intake_suggestions') as rls_on,
  (select count(*) from pg_policies where tablename in ('intake_tables', 'intake_suggestions')) as policies;
