-- ════════════════════════════════════════════════════════════════════
-- 0003 – Forintosító képletek, szakmai indoklás, szakértői paraméterek
--   A képlet csak kiinduló becslés; a szakértő tételenként felülírhatja.
--   Jogszabályi összeget nem kódolunk: az egységösszegek jóváhagyandó
--   paraméterek, a felelős divízió jóváhagyásával.
-- ════════════════════════════════════════════════════════════════════

-- Projekt-szintű pénzügyi alapadatok a képletekhez.
alter table engagements
  add column revenue_huf       bigint  check (revenue_huf >= 0),
  add column gross_margin_pct  numeric(5,4) check (gross_margin_pct between 0 and 1),
  add column actual_dso_days   smallint check (actual_dso_days >= 0),
  add column industry_dso_days smallint check (industry_dso_days >= 0);

-- Katalógus: alapértelmezett indoklás és képlet (lib/risk/valuation.ts Formula alak).
alter table risk_templates
  add column default_reasoning text,
  add column formula jsonb not null default '{"type":"MANUAL"}';

-- Tétel: szerkesztett indoklás, képlet, felülírás.
alter table red_flags
  add column reasoning   text,
  add column formula     jsonb,
  add column override_huf bigint check (override_huf >= 0),
  add column override_by  uuid references profiles,
  add column override_at  timestamptz,
  add constraint override_audit check (override_huf is null or (override_by is not null and override_at is not null));

create table expert_parameters (
  key          text primary key,               -- pl. TP_EXPOSURE_PER_RECORD
  label        text not null,
  value_huf    bigint not null check (value_huf >= 0),
  owner_division division not null,
  note         text,
  approved_by  uuid references profiles,
  approved_at  timestamptz,
  updated_at   timestamptz not null default now(),
  constraint approval_audit check ((approved_by is null) = (approved_at is null))
);
create trigger expert_parameters_updated before update on expert_parameters
  for each row execute function set_updated_at();

-- Értékváltozáskor a jóváhagyás elévül: újra jóvá kell hagyni.
create or replace function expert_parameter_reset_approval() returns trigger language plpgsql as $$
begin
  if new.value_huf is distinct from old.value_huf and new.approved_at is not distinct from old.approved_at then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;
create trigger expert_parameters_reapprove before update on expert_parameters
  for each row execute function expert_parameter_reset_approval();

insert into expert_parameters (key, label, value_huf, owner_division, note) values
  ('TP_EXPOSURE_PER_RECORD', 'Transzferár: becsült kitettség hiányzó nyilvántartásonként', 2000000, 'TAX',
   'Helykitöltő. Az adószakértők állítják be a bírsággyakorlat és a kockázati étvágy alapján.');

create trigger audit_expert_parameters after insert or update or delete on expert_parameters
  for each row execute function audit_row();

alter table expert_parameters enable row level security;
create policy expert_params_read on expert_parameters for select using (auth_role() <> 'client');
create policy expert_params_partner on expert_parameters for all using (is_partner()) with check (is_partner());
