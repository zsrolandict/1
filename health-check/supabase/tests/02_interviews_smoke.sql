-- Interjúmodul füstteszt (0002). Előfeltétel: 00_auth_stub + 0001 + 0002 + 01_rls_smoke (felhasználók, projekt).
\set ON_ERROR_STOP 1
reset role;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into interviews (id, engagement_id, role, interviewee_alias, pillar, confidential) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','KEY_PERSON','KP-1','HR',true),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','OWNER_CEO','CEO','FINANCE',false);
insert into interview_transcripts (id, interview_id, origin, timed, segments) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','NOTES',false,'[]'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','NOTES',false,'[]');

do $$ begin
  update interviews set recording_path = 'x', recording_delete_after = now() where id = '30000000-0000-0000-0000-000000000002';
  raise exception 'FAIL: recording without consent accepted';
exception when check_violation then raise notice 'OK  recording requires consent'; end $$;

do $$ begin
  insert into interview_findings (interview_id, transcript_id, kind, payload) values
   ('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','SUGGESTED_FLAG','{}');
  raise exception 'FAIL: finding without quote accepted';
exception when check_violation then raise notice 'OK  finding requires evidence quote'; end $$;

do $$ begin
  insert into interview_findings (interview_id, transcript_id, kind, payload, quote, decision) values
   ('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','STATEMENT','{}','idézet','ACCEPTED');
  raise exception 'FAIL: decision without reviewer accepted';
exception when check_violation then raise notice 'OK  decision requires reviewer'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false) \g /dev/null
select 'partner' who, count(*) interviews, (select count(*) from interview_transcripts) transcripts from interviews;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false) \g /dev/null
select 'hr' who, count(*) interviews, (select count(*) from interview_transcripts) transcripts from interviews;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false) \g /dev/null
select 'fin' who, string_agg(interviewee_alias, ',') visible, (select count(*) from interview_transcripts) transcripts from interviews;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false) \g /dev/null
select 'client' who, count(*) interviews, (select count(*) from interview_transcripts) transcripts from interviews;
