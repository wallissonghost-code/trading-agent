-- Decision journal. Applied to the Trading Agent Supabase project.
create table if not exists public.trading_paper_decisions (
 portfolio_id text not null references public.trading_paper_states(id) on delete restrict,
 symbol text not null check(symbol in ('BTCUSDT','ETHUSDT','SOLUSDT')),
 candle_close_time bigint not null check(candle_close_time>0),
 observed_at timestamptz not null,
 decision jsonb not null check(jsonb_typeof(decision)='object'),
 archived_at timestamptz not null default now(),
 primary key(portfolio_id,symbol,candle_close_time)
);
create index if not exists idx_trading_decisions_observed on public.trading_paper_decisions(portfolio_id,observed_at desc);
alter table public.trading_paper_decisions enable row level security;
revoke all on public.trading_paper_decisions from public,anon,authenticated;
grant select,insert on public.trading_paper_decisions to service_role;
create or replace function trading_private.archive_paper_decision()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare d jsonb;
begin
 d:=new.state->'lastDecision';
 if jsonb_typeof(d)='object' and (tg_op='INSERT' or d is distinct from old.state->'lastDecision') then
  insert into public.trading_paper_decisions(portfolio_id,symbol,candle_close_time,observed_at,decision)
  values(new.id,d->>'symbol',(d->>'candleCloseTime')::bigint,(d->>'observedAt')::timestamptz,d)
  on conflict(portfolio_id,symbol,candle_close_time) do nothing;
 end if;
 return new;
end $$;
revoke all on function trading_private.archive_paper_decision() from public,anon,authenticated;
grant execute on function trading_private.archive_paper_decision() to service_role;
drop trigger if exists trg_archive_paper_decision on public.trading_paper_states;
create trigger trg_archive_paper_decision after insert or update of state on public.trading_paper_states
for each row execute function trading_private.archive_paper_decision();
