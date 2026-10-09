-- 0015: szerveres projekttárolás – létrehozás, moduladatok, kiegészítő mentés.
-- Szereplők (01_rls_smoke): …001 partner, …002 HR szakértő, …003 pénzügyi szakértő, …004 ügyfél.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function append_ai_review(uuid, jsonb) from authenticated;

set role authenticated;
-- ── 1. Projekt létrehozása ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false) \g /dev/null
do $$ begin
  perform create_engagement('Szakértő Kft.', 'HEALTH_CHECK', 50000000);
  raise exception 'FAIL: szakértő projektet hozott létre';
exception when insufficient_privilege then raise notice 'OK  szakértő nem hoz létre projektet'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false) \g /dev/null
do $$ begin
  perform create_engagement('Ügyfél Kft.', 'HEALTH_CHECK', 50000000);
  raise exception 'FAIL: ügyfél projektet hozott létre';
exception when insufficient_privilege then raise notice 'OK  ügyfél nem hoz létre projektet'; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
do $$
declare
  eid uuid;
begin
  begin
    perform create_engagement('   ', 'HEALTH_CHECK', 50000000);
    raise exception 'FAIL: üres cégnév';
  exception when invalid_parameter_value then null; end;
  eid := create_engagement('Kitalált Minta Zrt.', 'VENDOR_DD', 80000000);
  if (select kind::text || '/' || materiality_huf || '/' || revision from engagements where id = eid) <> 'VENDOR_DD/80000000/0' then raise exception 'FAIL: projektadatok'; end if;
  if (select c.name from engagements e join companies c on c.id = e.company_id where e.id = eid) <> 'Kitalált Minta Zrt.' then raise exception 'FAIL: cégnév'; end if;
  if not exists (select 1 from engagement_members where engagement_id = eid and user_id = auth.uid() and member_role = 'partner') then raise exception 'FAIL: tagság'; end if;
  raise notice 'OK  partner projektet hoz létre (cég + tagság)';
end $$;

-- ── 2. Mentés moduladatokkal; változatlan tétel nem íródik ──────────
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
  fin jsonb := '{"id":"FIN-01","code":"FIN-01","pillar":"FINANCE","title":"Transzferár","description":"","identified":true,"likelihood":4,"impact":4,"exposureHuf":8000000,"remediationDays":15,"remediation":"x","division":"TAX","serviceFeeHuf":0}';
  hr jsonb := '{"id":"HR-01","code":"HR-01","pillar":"HR","title":"Kulcsember","description":"","identified":true,"likelihood":3,"impact":5,"exposureHuf":0,"remediationDays":45,"remediation":"y","division":"HR","serviceFeeHuf":0}';
begin
  rev := save_assessment(eng, rev, jsonb_build_array(fin, hr), '{"Q01":false}', '{}', '{"company":{}}', '{"totals":{"healthScore":40}}',
                         '{"intake":{"profile":{"narrative":"teszt"}},"snapshots":[{"at":"2026-01-01"}]}');
  if (select data -> 'profile' ->> 'narrative' from engagement_modules where engagement_id = eng and module = 'intake') <> 'teszt' then raise exception 'FAIL: moduladat'; end if;
  if (select snapshot -> 'totals' ->> 'healthScore' from engagements where id = eng) <> '40' then raise exception 'FAIL: pillanatkép'; end if;
  begin
    perform save_assessment(eng, rev, '[]', '{}', '{}', '{}', '{}', '{"titkos":{}}');
    raise exception 'FAIL: ismeretlen modul';
  exception when check_violation then null; end;
  if (select revision from engagements where id = eng) <> rev then raise exception 'FAIL: hibás modul nyomot hagyott'; end if;
  raise notice 'OK  moduladat és pillanatkép ugyanabban a tranzakcióban; ismeretlen modul elutasítva';
end $$;

-- A pénzügyi szakértő a TELJES listát küldi (a HR-tételt változatlanul): átmegy, a HR-tétel érintetlen.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
  fin jsonb := '{"id":"FIN-01","code":"FIN-01","pillar":"FINANCE","title":"Transzferár","description":"","identified":true,"likelihood":2,"impact":4,"exposureHuf":8000000,"remediationDays":15,"remediation":"x","division":"TAX","serviceFeeHuf":0}';
  hr jsonb := (select item || jsonb_build_object('trail', evidence_trail, 'history', change_log, 'discussion', discussion)
               from red_flags where engagement_id = '20000000-0000-0000-0000-000000000001' and item_key = 'HR-01');
begin
  perform save_assessment(eng, rev, jsonb_build_array(fin, hr), '{"Q01":false}', '{}', '{"company":{}}', '{}', '{}');
  if (select likelihood from red_flags where engagement_id = eng and item_key = 'FIN-01') <> 2 then raise exception 'FAIL: saját pillér nem mentődött'; end if;
  raise notice 'OK  pillér-tanácsadó a teljes listát mentheti, ha a más pillér tételét nem változtatja';
end $$;

-- ── 3. A szerver által közben hozzáfűzött vélemény nem vész el ──────
reset role;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$
declare
  rf uuid := (select id from red_flags where engagement_id = '20000000-0000-0000-0000-000000000001' and item_key = 'FIN-01');
begin
  perform append_ai_review(rf, '{"id":"ai-1","role":"AI","text":"Indokolt","review":{"verdict":"AGREE"}}');
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
  fin jsonb := '{"id":"FIN-01","code":"FIN-01","pillar":"FINANCE","title":"Transzferár","description":"","identified":true,"likelihood":3,"impact":4,"exposureHuf":8000000,"remediationDays":15,"remediation":"x","division":"TAX","serviceFeeHuf":0}';
begin
  -- a kliens másolatában még nincs benne az AI-bejegyzés
  perform save_assessment(eng, rev, jsonb_build_array(fin), '{}', '{}', '{}', '{}', '{}');
  if (select discussion -> 0 ->> 'id' from red_flags where engagement_id = eng and item_key = 'FIN-01') <> 'ai-1' then raise exception 'FAIL: az AI-bejegyzés elveszett'; end if;
  if (select likelihood from red_flags where engagement_id = eng and item_key = 'FIN-01') <> 3 then raise exception 'FAIL: a módosítás nem mentődött'; end if;
  raise notice 'OK  a régebbi kliens-másolat a szerver véleményeit nem törli';
end $$;

-- ── 4. Iratok pillérenként, összkép csak projektvezetőnek ───────────
-- HR-szakértő HR-iratot tölt fel (a kliens rossz pillért javasol: a szerver a saját pillérét adja).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
begin
  perform save_assessment(eng, rev, (select coalesce(jsonb_agg(item || jsonb_build_object('trail', evidence_trail, 'history', change_log, 'discussion', discussion)), '[]')
                                     from red_flags where engagement_id = eng and item_key is not null),
    '{}', '{}', '{}', '{}',
    '{"documents":[{"pillar":"FINANCE","data":{"id":"doc-hr","fileName":"munkaszerzodes.pdf","analysis":{"summary":"bizalmas"}}}],
      "synthesis":{"summary":"szakértő írta"}}');
  if (select pillar::text from engagement_documents where doc_id = 'doc-hr') <> 'HR' then raise exception 'FAIL: az irat nem a szakértő pillérébe került'; end if;
  if exists (select 1 from engagement_modules where module = 'synthesis') then raise exception 'FAIL: szakértő összképet írt'; end if;
  raise notice 'OK  szakértő irata a saját pillérébe kerül; összképet nem írhat';
end $$;

-- A pénzügyi szakértő nem látja a HR-iratot, és a mentése (iratlista nélküle) nem törli.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
begin
  if exists (select 1 from engagement_documents) then raise exception 'FAIL: más pillér irata látható'; end if;
  perform save_assessment(eng, rev, (select coalesce(jsonb_agg(item || jsonb_build_object('trail', evidence_trail, 'history', change_log, 'discussion', discussion)), '[]')
                                     from red_flags where engagement_id = eng and item_key is not null),
    '{}', '{}', '{}', '{}', '{"documents":[{"pillar":"FINANCE","data":{"id":"doc-fin","fileName":"beszamolo.pdf","analysis":{}}}]}');
  if (select count(*) from engagement_documents) <> 1 then raise exception 'FAIL: saját irat'; end if;
  raise notice 'OK  más pillér irata rejtve, és a mentés nem törli';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  rev int := (select revision from engagements where id = '20000000-0000-0000-0000-000000000001');
begin
  if (select count(*) from engagement_documents where engagement_id = eng) <> 2 then raise exception 'FAIL: a partner nem lát minden iratot'; end if;
  perform save_assessment(eng, rev, (select coalesce(jsonb_agg(item || jsonb_build_object('trail', evidence_trail, 'history', change_log, 'discussion', discussion)), '[]')
                                     from red_flags where engagement_id = eng and item_key is not null),
    '{}', '{}', '{}', '{}', '{"synthesis":{"summary":"partner írta"}}');
  if (select data ->> 'summary' from engagement_modules where engagement_id = eng and module = 'synthesis') <> 'partner írta' then raise exception 'FAIL: összkép'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) \g /dev/null
do $$ begin
  if exists (select 1 from engagement_modules where module = 'synthesis') then raise exception 'FAIL: szakértő látja az összképet'; end if;
  if (select count(*) from engagement_documents) <> 1 then raise exception 'FAIL: HR-szakértő láthatósága'; end if;
  raise notice 'OK  összkép csak projektvezetőnek; partner minden iratot lát';
end $$;

-- ── 5. Moduladat: ügyfél nem olvassa, idegen projektre nem írható ───
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false) \g /dev/null
do $$ begin
  if exists (select 1 from engagement_modules) or exists (select 1 from engagement_documents) then raise exception 'FAIL: ügyfél látja a moduladatot'; end if;
  raise notice 'OK  moduladat az ügyfélnek rejtve';
end $$;
reset role;
