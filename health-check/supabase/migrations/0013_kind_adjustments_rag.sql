-- ════════════════════════════════════════════════════════════════════
-- 0013 – Típuskorrekció az adatbázis besorolásában (audit K7)
--   Egy igazság a kódban és az adatbázisban: a ±1 típuskorrekció ugyanaz,
--   mint lib/engagement/adjustments.ts + lib/risk/engine.ts (scoreRisk).
--   A seed GENERÁLT (lib/db/sqlSync.ts); teszt ellenőrzi az egyezést, és a
--   supabase/tests/11_rag_parity.sql a TS-motor elvárt eredményeivel veti össze.
-- ════════════════════════════════════════════════════════════════════

-- Típusonkénti valószínűség/hatás-korrekció tételkódonként.
create table kind_adjustments (
  kind    engagement_kind not null,
  code    text not null,
  dl      smallint not null default 0 check (dl between -2 and 2),
  di      smallint not null default 0 check (di between -2 and 2),
  reason  text not null,
  approved_at timestamptz,
  primary key (kind, code)
);
alter table kind_adjustments enable row level security;
create policy kind_adjustments_read  on kind_adjustments for select using (auth.uid() is not null);
create policy kind_adjustments_write on kind_adjustments for all using (is_partner()) with check (is_partner());

-- A szakértő tételenként kikapcsolhatja a korrekciót (RiskItem.ignoreKindAdjustment).
alter table red_flags add column ignore_kind_adjustment boolean not null default false;

-- 1–5 skálára igazítás, mint a motor clampScale-je: hiányzó érték a legsúlyosabb (5).
create or replace function clamp_scale(x int) returns int language sql immutable as $$
  select case when x is null then 5 else least(5, greatest(1, x)) end
$$;

-- Besorolás típuskorrekcióval: előbb a megadott értékek igazítása, majd a korrekció
-- (ha nincs kikapcsolva), újra igazítva; a várható veszteség a korrigált valószínűséggel.
create or replace function red_flag_rag_for(
  likelihood int, impact int, exposure bigint, materiality bigint,
  eng_kind engagement_kind, item_code text, ignore_adjustment boolean default false
) returns rag language sql stable as $$
  select red_flag_rag(
    clamp_scale(clamp_scale(likelihood) + case when ignore_adjustment then 0 else coalesce(a.dl, 0) end),
    clamp_scale(clamp_scale(impact) + case when ignore_adjustment then 0 else coalesce(a.di, 0) end),
    greatest(coalesce(exposure, 0), 0),
    materiality
  )
  from (select 1) one
  left join kind_adjustments a on a.kind = eng_kind and a.code = item_code
$$;

comment on function red_flag_rag(int, int, bigint, bigint) is
  'Típuskorrekció NÉLKÜLI besorolás (alacsony szintű). Tételhez a red_flag_rag_for(…, kind, code, ignore) kell – az egyezik a TS-motorral.';

-- GENERÁLT (lib/db/sqlSync.ts › kindAdjustmentsSeedSql) – kézzel ne szerkeszd; a forrás lib/engagement/adjustments.ts.
insert into kind_adjustments (kind, code, dl, di, reason) values
  ('HEALTH_CHECK', 'LEG-01', -1, 0, 'Nincs tervezett tulajdonosváltás; a záradék csak tranzakciónál lép életbe.'),
  ('VENDOR_DD', 'FIN-01', 1, 0, 'A vevői átvilágítás a kapcsolt ügyleteket biztosan vizsgálja.'),
  ('VENDOR_DD', 'FIN-02', 0, 1, 'A normalizált EBITDA közvetlenül a vételárat határozza meg.'),
  ('VENDOR_DD', 'HR-01', 0, 1, 'A vevő a kulcsember-függőséget vételár-csökkentéssel vagy earn-outtal árazza.'),
  ('VENDOR_DD', 'ITF-01', 1, 0, 'Befektetői átvilágításon a licenceket rendszeresen szkennelik.'),
  ('VENDOR_DD', 'LEG-01', 2, 0, 'A tervezett tranzakció a záradékot biztosan kiváltja.'),
  ('VENDOR_DD', 'LEG-02', 0, 1, 'A vevő a szellemi tulajdon jogcímét a vételár alapjának tekinti.'),
  ('VENDOR_DD', 'LEG-03', 1, 0, 'A záráshoz a vevő rendezett társasági dokumentációt kér.'),
  ('BUY_SIDE_DD', 'FIN-01', 1, 0, 'A zárás előtti időszak adókockázata a vevőnél jelentkezik.'),
  ('BUY_SIDE_DD', 'FIN-02', 0, 1, 'Az eredményminőség közvetlenül a vételárat érinti.'),
  ('BUY_SIDE_DD', 'FIN-04', 1, 0, 'A zárás utáni adóellenőrzés kockázata a vevőt terheli.'),
  ('BUY_SIDE_DD', 'HR-01', 0, 1, 'A kulcsember távozása a megvásárolt érték jelentős részét viheti el.'),
  ('BUY_SIDE_DD', 'LEG-01', 2, 0, 'A tervezett tranzakció a záradékot biztosan kiváltja.'),
  ('BUY_SIDE_DD', 'LEG-02', 0, 1, 'A megvásárolt fő eszköz jogcíme bizonytalan.'),
  ('BUY_SIDE_DD', 'OPS-01', 0, 1, 'A vevő a bevétel és a fedezet stabilitását árazza.'),
  ('FINANCING_READINESS', 'EPI-02', 1, 0, 'A bank a megrendelői koncentrációt külön kockázatként kezeli.'),
  ('FINANCING_READINESS', 'FIN-02', 0, 1, 'A hitelképesség a fenntartható EBITDA-n alapul.'),
  ('FINANCING_READINESS', 'FIN-03', 0, 1, 'A bank a forgótőkét és a vevőminőséget vizsgálja elsőként.'),
  ('FINANCING_READINESS', 'HR-04', 0, -1, 'A hitelbírálat szempontjából másodlagos.'),
  ('FINANCING_READINESS', 'LEG-01', -1, 0, 'Nincs tervezett tulajdonosváltás.'),
  ('FINANCING_READINESS', 'OPS-01', 0, 1, 'Egy beszállítói kiesés a cash-flow-t és a törlesztést veszélyezteti.'),
  ('SUCCESSION', 'FIN-01', -1, 0, 'Tranzakciós vizsgálat nincs; a kockázat a szokásos adóellenőrzésre korlátozódik.'),
  ('SUCCESSION', 'HR-01', 1, 0, 'Az átadás pontosan ezt a függőséget teszi próbára.'),
  ('SUCCESSION', 'HR-04', 0, 1, 'Vezetőváltáskor nő a kulcsmunkatársak kilépési hajlandósága.'),
  ('SUCCESSION', 'LEG-03', 2, 0, 'Az üzletrész-átruházáshoz rendezett létesítő okirat kell.'),
  ('COMPLIANCE_AUDIT', 'EPI-04', 1, 0, 'Munkavédelmi ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'FIN-01', 1, 0, 'Hatósági ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'FIN-02', 0, -1, 'Megfelelőségi szempontból másodlagos.'),
  ('COMPLIANCE_AUDIT', 'FIN-04', 1, 0, 'Hatósági ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'HR-02', 1, 0, 'Munkaügyi és adóellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'HR-03', 1, 0, 'Munkaügyi ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'KON-02', 1, 0, 'Felügyeleti ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'LEG-01', -1, 0, 'Megfelelőségi szempontból nem releváns.'),
  ('COMPLIANCE_AUDIT', 'LEG-04', 1, 0, 'Hatósági ellenőrzés kiemelt területe.'),
  ('COMPLIANCE_AUDIT', 'OPS-04', 0, 1, 'Engedély hiányában a tevékenység felfüggeszthető.'),
  ('POST_MERGER', 'FIN-02', 0, -1, 'Az akvizíció már lezárult; az eredményminőség már nem árazási kérdés.'),
  ('POST_MERGER', 'HR-01', 1, 0, 'Tulajdonosváltás után nő a kulcsemberek távozási hajlandósága.'),
  ('POST_MERGER', 'HR-04', 1, 0, 'Az integráció bizonytalansága növeli a fluktuációt.'),
  ('POST_MERGER', 'LEG-01', 1, 0, 'A lezajlott tulajdonosváltás után a partnerek élhetnek a felmondási joggal.'),
  ('POST_MERGER', 'OPS-02', 0, 1, 'Az integráció a rendszerek összevonásán múlik.');
