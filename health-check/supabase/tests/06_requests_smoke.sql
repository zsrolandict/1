select 'requests' as t,
  (select count(*) from information_schema.columns where table_name = 'document_requests' and column_name in ('template_id', 'reasons', 'source', 'priority')) as new_columns,
  (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'doc_request_status' and e.enumlabel = 'MISSING') as missing_status,
  (select count(*) from information_schema.columns where table_name = 'engagements' and column_name = 'case_profile') as case_profile;
