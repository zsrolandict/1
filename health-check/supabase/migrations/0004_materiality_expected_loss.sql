-- ════════════════════════════════════════════════════════════════════
-- 0004 – Lényegességi küszöb a VÁRHATÓ veszteséghez mérve
--   Korábban: bruttó kitettség ≥ küszöb → piros.
--   Most: kitettség × valószínűség ≥ küszöb → piros (lib/risk/engine.ts).
--   A régi (score, exposure, materiality) függvény marad visszafelé
--   kompatibilitásként, de már nem használjuk.
-- ════════════════════════════════════════════════════════════════════

create or replace function likelihood_probability(likelihood int)
returns numeric language sql immutable as $$
  select case likelihood
    when 1 then 0.05 when 2 then 0.20 when 3 then 0.40 when 4 then 0.65 when 5 then 0.90
  end::numeric
$$;

create or replace function red_flag_rag(likelihood int, impact int, exposure bigint, materiality bigint)
returns rag language sql immutable as $$
  select case
    when likelihood * impact >= 15 then 'RED'::rag
    when round(exposure * likelihood_probability(likelihood)) >= materiality then 'RED'::rag
    when likelihood * impact >= 8 then 'AMBER'::rag
    else 'GREEN'::rag
  end
$$;

comment on function red_flag_rag(int, bigint, bigint) is 'ELAVULT (0004): bruttó kitettséggel számolt; helyette red_flag_rag(likelihood, impact, exposure, materiality).';
