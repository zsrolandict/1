-- 0004: a lényegességi küszöb a várható veszteséghez mér (a motorral egyezően)
select 'rag_expected_loss' as t,
  red_flag_rag(5, 2, 60000000, 50000000)  as v5_60m_red,      -- 54 M ≥ 50 M → RED
  red_flag_rag(1, 2, 600000000, 50000000) as v1_600m_green,   -- 30 M < 50 M → GREEN
  red_flag_rag(2, 5, 228000000, 50000000) as coc_hc_amber,    -- 46 M < 50 M, 10 pont → AMBER
  red_flag_rag(5, 5, 228000000, 50000000) as coc_vdd_red;     -- 25 pont → RED
