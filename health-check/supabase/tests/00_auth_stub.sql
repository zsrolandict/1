-- Csak helyi, "csupasz" PostgreSQL-hez: a Supabase auth séma minimális utánzata.
-- Supabase-en (supabase db reset) erre NINCS szükség.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
