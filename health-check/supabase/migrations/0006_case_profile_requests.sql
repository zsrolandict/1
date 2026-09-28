-- ════════════════════════════════════════════════════════════════════
-- 0006 – Előzetes tényállás és iratbekérési lista
--   A lista szabály alapján áll össze (lib/intake/requests.ts): alap
--   iratkör + cél + ágazat + létszám + jellemzők; AI csak javasol.
-- ════════════════════════════════════════════════════════════════════

-- Tényállás a projekten: {"sector":"CONSULTING","headcount":30,"flags":[...],"narrative":"..."}
alter table engagements add column case_profile jsonb not null default '{}';

-- „Hiányzik”: az ügyfél jelezte, hogy nincs ilyen irat – az interjún rákérdezünk.
alter type doc_request_status add value if not exists 'MISSING';

alter table document_requests
  add column template_id text,                         -- B01, K11, S02 … (null = egyedi)
  add column reasons     text[] not null default '{}', -- miért kérjük
  add column source      text not null default 'BASE'
    check (source in ('BASE', 'KIND', 'SECTOR', 'SIZE', 'FLAG', 'AI', 'MANUAL')),
  add column priority    text not null default 'REQUIRED'
    check (priority in ('REQUIRED', 'RECOMMENDED'));

create unique index document_requests_template_uq
  on document_requests (engagement_id, template_id) where template_id is not null;
