-- Run only on a dedicated ACTIVE Supabase project chosen for trading-agent.
-- State is private; no anon or authenticated access. Server-side service-role only.
create table if not exists public.trading_paper_states (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint paper_state_schema check (state->>'schema' = '1')
);
alter table public.trading_paper_states enable row level security;
revoke all on table public.trading_paper_states from anon, authenticated;
-- Intentionally no public RLS policies. Only privileged server-side service role.
