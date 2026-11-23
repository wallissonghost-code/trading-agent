-- Applied to dedicated Trading Agent Supabase database on 2026-11-23.
-- Transactions that update the account snapshot also archive all recent fills.
create table if not exists public.trading_paper_ledger (
  portfolio_id text not null references public.trading_paper_states(id) on delete restrict,
  symbol text not null check (symbol in ('BTCUSDT','ETHUSDT','SOLUSDT')),
  side text not null check (side in ('BUY','SELL')),
  candle_close_time bigint not null,
  executed_at timestamptz not null,
  trade jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (portfolio_id,symbol,side,candle_close_time),
  constraint paper_ledger_trade_object check (jsonb_typeof(trade)='object')
);
alter table public.trading_paper_ledger enable row level security;
revoke all on public.trading_paper_ledger from public, anon, authenticated;
grant select, insert on public.trading_paper_ledger to service_role;
create schema if not exists trading_private;
revoke all on schema trading_private from public,anon,authenticated;
create or replace function trading_private.archive_paper_trades()
returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  insert into public.trading_paper_ledger(portfolio_id,symbol,side,candle_close_time,executed_at,trade)
  select new.id,entry->>'symbol',entry->>'side',
    (entry->>'candleCloseTime')::bigint,
    (entry->>'time')::timestamptz,entry
  from jsonb_array_elements(coalesce(new.state->'trades','[]'::jsonb)) as entry
  where entry->>'symbol' in ('BTCUSDT','ETHUSDT','SOLUSDT')
    and entry->>'side' in ('BUY','SELL')
    and entry->>'candleCloseTime' is not null
    and entry->>'time' is not null
  on conflict(portfolio_id,symbol,side,candle_close_time) do nothing;
  return new;
end $$;
revoke all on function trading_private.archive_paper_trades() from public,anon,authenticated;
grant usage on schema trading_private to service_role;
grant execute on function trading_private.archive_paper_trades() to service_role;
drop trigger if exists trg_archive_paper_trades on public.trading_paper_states;
create trigger trg_archive_paper_trades
after insert or update of state on public.trading_paper_states
for each row execute function trading_private.archive_paper_trades();
