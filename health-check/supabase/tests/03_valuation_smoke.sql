-- 0003 füstteszt. Előfeltétel: 00 + 0001 + 0002 + 0003 + 01_rls_smoke.
\set ON_ERROR_STOP 1
reset role;
grant all on all tables in schema public to authenticated;

update expert_parameters set approved_by = '00000000-0000-0000-0000-000000000001', approved_at = now() where key = 'TP_EXPOSURE_PER_RECORD';
update expert_parameters set value_huf = 3000000 where key = 'TP_EXPOSURE_PER_RECORD';
do $$ begin
  if (select approved_at from expert_parameters where key = 'TP_EXPOSURE_PER_RECORD') is not null then
    raise exception 'FAIL: value change kept approval';
  end if;
  raise notice 'OK  value change resets approval';
end $$;

do $$ begin
  update red_flags set override_huf = 1 where title = 'Kulcsember';
  raise exception 'FAIL: override without author accepted';
exception when check_violation then raise notice 'OK  override requires author'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false) \g /dev/null
select 'client' who, count(*) params from expert_parameters;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false) \g /dev/null
select 'fin' who, count(*) params from expert_parameters;
do $$ begin
  update expert_parameters set value_huf = 1;
  if found then raise exception 'FAIL: consultant changed parameter'; end if;
  raise notice 'OK  consultant cannot change parameter';
end $$;
