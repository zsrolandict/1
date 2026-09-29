select 'benchmark' as t,
  (select count(*) from information_schema.columns where table_name = 'engagements' and column_name in ('registry', 'disabled_modules')) as engagement_columns,
  (select count(*) from information_schema.columns where table_name = 'timesheet_entries' and column_name = 'work_role') as work_role,
  (select count(*) from information_schema.columns where table_name = 'benchmark_records' and column_name in ('engagement_id', 'company_name')) as identifying_columns_must_be_0,
  (select relrowsecurity from pg_class where relname = 'benchmark_records') as rls_on;
