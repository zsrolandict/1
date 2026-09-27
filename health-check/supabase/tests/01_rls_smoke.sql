-- RLS füstteszt: partner / HR szakértő / pénzügyi szakértő / ügyfél / idegen ügyfél nézőpont.
-- Futtatás: lásd health-check/README.md
\set ON_ERROR_STOP 1
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public, auth to authenticated;

insert into auth.users values
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005');
insert into profiles (id, full_name, email, role, specialty, hourly_cost_huf) values
 ('00000000-0000-0000-0000-000000000001','Partner','p@ict.hu','partner',null,40000),
 ('00000000-0000-0000-0000-000000000002','HR szakértő','hr@ict.hu','consultant','HR',20000),
 ('00000000-0000-0000-0000-000000000003','Pénzügy','fin@ict.hu','consultant','FINANCE',25000),
 ('00000000-0000-0000-0000-000000000004','Ügyfél','cfo@minta.hu','client',null,null),
 ('00000000-0000-0000-0000-000000000005','Idegen ügyfél','x@mas.hu','client',null,null);
insert into companies (id,name) values ('10000000-0000-0000-0000-000000000001','Minta Kft');
insert into engagements (id, company_id, code) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','HC-2026-001');
insert into engagement_members values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','consultant','HR'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','consultant','FINANCE'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','client',null);
insert into documents (engagement_id, category, pillar, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by) values
 ('20000000-0000-0000-0000-000000000001','GENERAL_LEDGER','FINANCE','vdr/a','fokonyv.xlsx','x',1,'h','00000000-0000-0000-0000-000000000004'),
 ('20000000-0000-0000-0000-000000000001','EMPLOYMENT','HR','vdr/b','munkaszerz.pdf','x',1,'h','00000000-0000-0000-0000-000000000002');
insert into key_person_assessments (engagement_id, person_alias, position, interview_notes) values
 ('20000000-0000-0000-0000-000000000001','KP-1','Ügyvezető','bizalmas');
insert into red_flags (engagement_id, pillar, title, identified, likelihood, impact, division) values
 ('20000000-0000-0000-0000-000000000001','HR','Kulcsember',true,3,5,'HR');
insert into hour_budgets (engagement_id, pillar, budget_hours) values
 ('20000000-0000-0000-0000-000000000001','HR',3),('20000000-0000-0000-0000-000000000001',null,2);
insert into timesheet_entries (engagement_id,user_id,pillar,hours,activity) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','HR',2.5,'interjú');
insert into credit_ledger (company_id, engagement_id, entry_type, amount_huf) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','AUDIT_FEE_PAID',1200000);

-- Duplikált PM keret tiltott
do $$ begin
  insert into hour_budgets (engagement_id, pillar, budget_hours) values ('20000000-0000-0000-0000-000000000001',null,1);
  raise exception 'FAIL: duplicate PM budget accepted';
exception when unique_violation then raise notice 'OK  hour_budgets PM unique'; end $$;

-- Kredit nem mehet negatívba, és append-only
do $$ begin
  insert into credit_ledger (company_id, engagement_id, entry_type, amount_huf) values
   ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','CREDIT_APPLIED',-1300000);
  raise exception 'FAIL: overdraw accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK  credit overdraw blocked'; end $$;
do $$ begin
  update credit_ledger set amount_huf = 1;
  raise exception 'FAIL: ledger update accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'OK  ledger append-only'; end $$;

select 'rag' as t, red_flag_rag(6, 60000000, 50000000) as materiality_red, red_flag_rag(12, 0, 50000000) as amber;
select engagement_id is not null as ok, hours_used, burn_pct, cost_huf, margin_huf from v_engagement_burn;
select pillar, budget_hours, hours_used, burn_pct from v_pillar_burn order by pillar nulls last;

set role authenticated;
\echo '--- view: user / documents / key_person / red_flags / engagements'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false) \g /dev/null
select 'partner' who, (select count(*) from documents) docs, (select count(*) from key_person_assessments) kp, (select count(*) from red_flags) rf, (select count(*) from engagements) eng;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false) \g /dev/null
select 'hr' who, (select string_agg(file_name, ',') from documents) docs, (select count(*) from key_person_assessments) kp, (select count(*) from red_flags) rf, (select count(*) from engagements) eng;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false) \g /dev/null
select 'fin' who, (select string_agg(file_name, ',') from documents) docs, (select count(*) from key_person_assessments) kp, (select count(*) from red_flags) rf, (select count(*) from engagements) eng;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false) \g /dev/null
select 'client' who, (select string_agg(file_name, ',') from documents) docs, (select count(*) from key_person_assessments) kp, (select count(*) from red_flags) rf, (select count(*) from engagements) eng, (select balance_huf from v_credit_balance) credit;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false) \g /dev/null
select 'outsider' who, (select count(*) from documents) docs, (select count(*) from key_person_assessments) kp, (select count(*) from red_flags) rf, (select count(*) from engagements) eng, (select count(*) from companies) co;

-- Pénzügyi szakértő nem írhat HR red flaget
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false) \g /dev/null
do $$ begin
  insert into red_flags (engagement_id, pillar, title, likelihood, impact, division) values
   ('20000000-0000-0000-0000-000000000001','HR','x',1,1,'HR');
  raise exception 'FAIL: fin wrote HR flag';
exception when insufficient_privilege then raise notice 'OK  fin cannot write HR red flag'; end $$;
