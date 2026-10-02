-- 0014: szerveroldali bizalom – meghívás, hiteles napló, elosztott korlát, atomikus mentés.
-- Szereplők (01_rls_smoke): …001 partner, …002 HR szakértő, …003 pénzügyi szakértő, …004 ügyfél.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- A szerverfüggvényt a migráció kifejezetten elvette; a fenti általános grant ne adja vissza.
revoke execute on function append_ai_review(uuid, jsonb) from authenticated;
revoke execute on function hook_before_user_created(jsonb) from authenticated;

-- ── 1. Meghívásos regisztráció ──────────────────────────────────────
do $$ begin
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'kereteln@pelda.hu');
  raise exception 'FAIL: meghívás nélküli regisztráció átment';
exception when insufficient_privilege then raise notice 'OK  meghívás nélkül nincs fiók'; end $$;

insert into invitations (email, full_name, role, specialty) values ('uj.kolléga@ict.hu', 'Új Kolléga', 'consultant', 'LEGAL');
do $$ begin
  if hook_before_user_created('{"user":{"email":"idegen@pelda.hu"}}') -> 'error' ->> 'http_code' <> '403' then raise exception 'FAIL: hook átengedte'; end if;
  if hook_before_user_created('{"user":{"email":"UJ.kolléga@ict.hu"}}') <> '{}'::jsonb then raise exception 'FAIL: hook a meghívottat elutasította'; end if;
  raise notice 'OK  before-user-created hook';
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ab', 'uj.kolléga@ict.hu');
do $$ begin
  if (select role from profiles where id = '00000000-0000-0000-0000-0000000000ab') <> 'consultant' then raise exception 'FAIL: profil nem a meghívásból jött'; end if;
  if (select accepted_at from invitations where email = 'uj.kolléga@ict.hu') is null then raise exception 'FAIL: meghívás nincs lezárva'; end if;
  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ac', 'uj.kolléga@ict.hu');
    raise exception 'FAIL: a meghívás kétszer is felhasználható';
  exception when insufficient_privilege then null; when unique_violation then null; end;
  raise notice 'OK  meghívásból profil, egyszer használható';
end $$;

-- ── 2. Hiteles napló (a HR szakértő a saját pillérének tételén) ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) \g /dev/null
do $$
declare
  rf uuid := (select id from red_flags where title = 'Kulcsember');
  t jsonb;
begin
  -- új bejegyzés hamis elfogadóval → a szerver írja be a valódit
  update red_flags set evidence_trail = '[{"id":"e1","kind":"INTERVIEW","actor":"EXPERT","ref":"HR-interjú","acceptedBy":"Partner","at":"2020-01-01T00:00:00Z"}]' where id = rf;
  t := (select evidence_trail -> 0 from red_flags where id = rf);
  if t ->> 'acceptedBy' <> 'HR szakértő' or (t ->> 'at')::timestamptz < now() - interval '1 minute' then raise exception 'FAIL: nem a szerver bélyegzett: %', t; end if;
  -- elavult kliens-másolat (régi bélyeg) újraküldve: elfogadott, a tárolt marad
  update red_flags set evidence_trail = '[{"id":"e1","kind":"INTERVIEW","actor":"EXPERT","ref":"HR-interjú","acceptedBy":"Partner","at":"2020-01-01T00:00:00Z"}]' where id = rf;
  if (select evidence_trail -> 0 ->> 'acceptedBy' from red_flags where id = rf) <> 'HR szakértő' then raise exception 'FAIL: a bélyeg felülíródott'; end if;
  begin
    update red_flags set evidence_trail = '[{"id":"e1","kind":"INTERVIEW","actor":"EXPERT","ref":"MÁS forrás"}]' where id = rf;
    raise exception 'FAIL: korábbi bizonyíték módosítható';
  exception when insufficient_privilege then null; end;
  begin
    update red_flags set evidence_trail = '[]' where id = rf;
    raise exception 'FAIL: bizonyíték törölhető';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  bizonyíték-lánc: szerver-bélyeg, csak hozzáfűzhető';

  -- vélemény: AI-bejegyzés kliensről tilos; szakértői bejegyzés szerzője a bejelentkezett felhasználó
  begin
    update red_flags set discussion = '[{"id":"a1","role":"AI","text":"Egyetért","review":{"verdict":"AGREE"}}]' where id = rf;
    raise exception 'FAIL: hamis AI-felülvizsgálat átment';
  exception when insufficient_privilege then null; end;
  update red_flags set discussion = '[{"id":"o1","role":"EXPERT","text":"Túlzó","by":"Partner"}]' where id = rf;
  if (select discussion -> 0 ->> 'by' from red_flags where id = rf) <> 'HR szakértő' then raise exception 'FAIL: vélemény szerzője hamisítható'; end if;
  raise notice 'OK  vélemény: AI csak szerverről, szerző a bejelentkezett';

  -- változásnapló: hozzáfűzés bélyeggel; indoklás egyszer pótolható; utána nem írható át
  update red_flags set change_log = '[{"field":"likelihood","from":"4","to":"3","reduces":true,"by":"Partner"}]' where id = rf;
  if (select change_log -> 0 ->> 'by' from red_flags where id = rf) <> 'HR szakértő' then raise exception 'FAIL: napló szerzője hamisítható'; end if;
  update red_flags set change_log = '[{"field":"likelihood","from":"4","to":"3","reduces":true,"reason":"Az interjú alapján"}]' where id = rf;
  if (select change_log -> 0 ->> 'reason' from red_flags where id = rf) <> 'Az interjú alapján' then raise exception 'FAIL: indoklás nem pótolható'; end if;
  begin
    update red_flags set change_log = '[{"field":"likelihood","from":"4","to":"3","reduces":true,"reason":"Más ok"}]' where id = rf;
    raise exception 'FAIL: megadott indoklás átírható';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  változásnapló: bélyeg, indoklás egyszer';
end $$;

-- más felhasználó (partner) nem vonhatja össze / írhatja át a HR szakértő bejegyzését
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
do $$ begin
  update red_flags set change_log = '[{"field":"likelihood","from":"4","to":"2","reduces":true,"reason":"Az interjú alapján"}]' where title = 'Kulcsember';
  raise exception 'FAIL: más felhasználó átírta a naplót';
exception when insufficient_privilege then raise notice 'OK  napló: más felhasználó nem írhatja át'; end $$;

-- AI-felülvizsgálatot rögzítő függvény: bejelentkezett felhasználó nem hívhatja
do $$ begin
  perform append_ai_review((select id from red_flags where title = 'Kulcsember'), '{"id":"a1","role":"AI","text":"x"}');
  raise exception 'FAIL: kliens rögzíthet AI-felülvizsgálatot';
exception when insufficient_privilege then raise notice 'OK  append_ai_review csak szerverről'; end $$;

-- ── 3. Elosztott hívásszám-korlát ───────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) \g /dev/null
do $$
declare a boolean; b boolean; c boolean; r int;
begin
  select ok into a from rate_limit_hit('ai', 2, 3600);
  select ok into b from rate_limit_hit('ai', 2, 3600);
  select ok, retry_after into c, r from rate_limit_hit('ai', 2, 3600);
  if not (a and b and not c and r > 0) then raise exception 'FAIL: korlát: % % % %', a, b, c, r; end if;
  begin
    perform 1 from rate_limits;
    if (select count(*) from rate_limits) > 0 then raise exception 'FAIL: a korláttábla közvetlenül olvasható'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'OK  korlát: felhasználónként, a táblához nincs közvetlen hozzáférés';
end $$;
-- más felhasználó külön keretet kap (a kulcs auth.uid(), nem kliens által küldött érték)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false) \g /dev/null
do $$ begin
  if not (select ok from rate_limit_hit('ai', 2, 3600)) then raise exception 'FAIL: közös keret'; end if;
  raise notice 'OK  korlát kulcsa a bejelentkezett felhasználó';
end $$;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  perform rate_limit_hit('ai', 2, 3600);
  raise exception 'FAIL: bejelentkezés nélkül is számol';
exception when insufficient_privilege then raise notice 'OK  korlát: bejelentkezés nélkül tilos'; end $$;

-- ── 4. Atomikus mentés (partner) ────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
do $$
declare
  eng uuid := '20000000-0000-0000-0000-000000000001';
  item1 jsonb := '{"id":"FIN-01","code":"FIN-01","pillar":"FINANCE","title":"Transzferár","description":"","identified":true,"likelihood":4,"impact":4,"exposureHuf":8000000,"remediationDays":15,"remediation":"x","division":"TAX","serviceFeeHuf":0}';
  item2 jsonb := '{"id":"HR-01","code":"HR-01","pillar":"HR","title":"Kulcsember","description":"","identified":true,"likelihood":3,"impact":5,"exposureHuf":0,"remediationDays":45,"remediation":"y","division":"HR","serviceFeeHuf":0}';
  bad jsonb := '{"id":"LEG-01","code":"LEG-01","pillar":"LEGAL","title":"Rossz","description":"","identified":true,"likelihood":9,"impact":5,"exposureHuf":0,"remediationDays":1,"remediation":"","division":"LEGAL","serviceFeeHuf":0}';
  rev int;
begin
  rev := save_assessment(eng, 0, jsonb_build_array(item1, item2), '{"Q01":false}', '{"d1":"RECEIVED"}', '{"company":{}}', '{"totals":{"healthScore":42}}');
  if rev <> 1 then raise exception 'FAIL: revízió %', rev; end if;
  if (select count(*) from red_flags where engagement_id = eng and item_key is not null) <> 2 then raise exception 'FAIL: tételek'; end if;
  if (select count(*) from reports where engagement_id = eng) <> 1 then raise exception 'FAIL: riportrekord'; end if;
  if (select answers ->> 'Q01' from engagement_answers where engagement_id = eng) <> 'false' then raise exception 'FAIL: válaszok'; end if;

  -- verzióütközés: semmi nem változik
  begin
    perform save_assessment(eng, 0, jsonb_build_array(item1), '{}', '{}', '{}', '{}');
    raise exception 'FAIL: elavult verzió átment';
  exception when serialization_failure then null; end;

  -- hiba a mentés közepén (érvénytelen tétel a végén): teljes visszagörgetés
  begin
    perform save_assessment(eng, 1, jsonb_build_array(item1 || '{"likelihood":2}', bad), '{"Q01":true}', '{}', '{"x":1}', '{"totals":{"healthScore":99}}');
    raise exception 'FAIL: érvénytelen tétel átment';
  exception when check_violation then null; end;
  if (select likelihood from red_flags where engagement_id = eng and item_key = 'FIN-01') <> 4 then raise exception 'FAIL: félkész tétel maradt'; end if;
  if (select count(*) from reports where engagement_id = eng) <> 1 then raise exception 'FAIL: félkész riportrekord maradt'; end if;
  if (select revision from engagements where id = eng) <> 1 then raise exception 'FAIL: a verzió elmozdult'; end if;
  if (select answers ->> 'Q01' from engagement_answers where engagement_id = eng) <> 'false' then raise exception 'FAIL: félkész válasz maradt'; end if;
  raise notice 'OK  atomikus mentés: siker, verzióütközés és hiba esetén nincs félkész állapot';
end $$;

-- ügyfél nem menthet; a pénzügyi szakértő más pillér tételét nem írhatja (az egész mentés elbukik)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false) \g /dev/null
do $$ begin
  perform save_assessment('20000000-0000-0000-0000-000000000001', 1, '[]', '{}', '{}', '{}', '{}');
  raise exception 'FAIL: ügyfél mentett';
exception when insufficient_privilege then raise notice 'OK  ügyfél nem menthet'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false) \g /dev/null
do $$ begin
  perform save_assessment('20000000-0000-0000-0000-000000000001', 1,
    '[{"id":"HR-01","code":"HR-01","pillar":"HR","title":"Átírva","description":"","identified":false,"likelihood":1,"impact":1,"exposureHuf":0,"remediationDays":1,"remediation":"","division":"HR","serviceFeeHuf":0}]',
    '{}', '{}', '{}', '{}');
  raise exception 'FAIL: pillér-jogosultság megkerülhető';
exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin
  if (select title from red_flags where item_key = 'HR-01') <> 'Kulcsember' or (select revision from engagements where id = '20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FAIL: a jogosulatlan mentés nyomot hagyott';
  end if;
  raise notice 'OK  pillér-jogosultság a mentésben is, nyom nélkül';
end $$;
