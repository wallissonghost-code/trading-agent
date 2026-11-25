-- Atomic paper-candle journal: rows mean the paper engine accepted this candle and
-- its matching portfolio update committed. Never historical backfill or inferred fills.
create table if not exists public.trading_paper_candle_journal (
 portfolio_id text not null references public.trading_paper_states(id),
 symbol text not null check(symbol in ('BTCUSDT','ETHUSDT','SOLUSDT')),
 candle_close_time bigint not null check(candle_close_time>0 and (candle_close_time+1)%300000=0),
 previous_close_time bigint,
 action text not null check(action in ('BUY','SELL','WAIT')),
 reason text not null check(length(reason) between 1 and 96),
 observed_at timestamptz not null,
 committed_at timestamptz not null default now(),
 primary key(portfolio_id,symbol,candle_close_time)
);
create index if not exists trading_paper_candle_journal_recent
 on public.trading_paper_candle_journal(portfolio_id,committed_at desc);
alter table public.trading_paper_candle_journal enable row level security;
revoke all on public.trading_paper_candle_journal from public,anon,authenticated,service_role;
grant select,insert on public.trading_paper_candle_journal to service_role;
-- Restrict mutations even for roles that have broad default access.
create or replace function public.trading_deny_paper_journal_mutation()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception 'Paper journal is append-only' using errcode='42501';
end;$$;
revoke execute on function public.trading_deny_paper_journal_mutation() from public,anon,authenticated;
drop trigger if exists trading_paper_journal_no_mutation on public.trading_paper_candle_journal;
create trigger trading_paper_journal_no_mutation before update or delete
 on public.trading_paper_candle_journal for each row
 execute function public.trading_deny_paper_journal_mutation();
drop trigger if exists trading_paper_journal_no_truncate on public.trading_paper_candle_journal;
create trigger trading_paper_journal_no_truncate before truncate
 on public.trading_paper_candle_journal for each statement
 execute function public.trading_deny_paper_journal_mutation();

create or replace function public.trading_commit_paper_candle(
 p_portfolio text,p_symbol text,p_previous_close bigint,p_close bigint,
 p_state jsonb,p_action text,p_reason text,p_observed_at timestamptz
) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare changed integer;
begin
 if p_symbol not in ('BTCUSDT','ETHUSDT','SOLUSDT')
  or p_action not in ('BUY','SELL','WAIT')
  or p_reason is null or length(p_reason) not between 1 and 96
  or p_close is null or p_close<=0 or (p_close+1)%300000<>0
  or p_state is null or p_observed_at is null
  or p_state->>'schema'<>'1'
  or (p_state#>>array['lastCandle',p_symbol]) is distinct from p_close::text
  or (p_previous_close is not null and p_previous_close>=p_close)
 then raise exception 'Invalid paper candle commit' using errcode='22023';
 end if;
 update public.trading_paper_states
 set state=p_state,updated_at=now()
 where id=p_portfolio
 and (state#>>array['lastCandle',p_symbol])
    is not distinct from p_previous_close::text;
 get diagnostics changed=row_count;
 if changed<>1 then
  raise exception 'Paper candle cursor conflict' using errcode='40001';
 end if;
 insert into public.trading_paper_candle_journal
 (portfolio_id,symbol,candle_close_time,previous_close_time,action,reason,observed_at)
 values (p_portfolio,p_symbol,p_close,p_previous_close,p_action,p_reason,p_observed_at);
 return pg_catalog.jsonb_build_object('ok',true,'symbol',p_symbol,'candleCloseTime',p_close);
end;$$;
revoke all on function public.trading_commit_paper_candle(text,text,bigint,bigint,jsonb,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.trading_commit_paper_candle(text,text,bigint,bigint,jsonb,text,text,timestamptz)
 to service_role;

create or replace function public.trading_paper_journal_report(p_portfolio text)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 with bounds as (
  select (floor(extract(epoch from now())/300)*300*1000)::bigint-1 as last_closed,
   now()-interval '7 days' as since7,
   now()-interval '24 hours' as since24
 ), symbols as (select unnest(array['BTCUSDT','ETHUSDT','SOLUSDT']) as symbol),
 counts as (
  select s.symbol,
   count(j.candle_close_time) filter(where j.candle_close_time>=b.last_closed-287*300000) as recorded24,
   count(j.candle_close_time) filter(where j.candle_close_time>=b.last_closed-2015*300000) as recorded7d,
   max(j.candle_close_time) as last_paper_candle,
   min(j.committed_at) as first_commit_at
  from symbols s cross join bounds b
  left join public.trading_paper_candle_journal j
   on j.symbol=s.symbol and j.portfolio_id=p_portfolio
   and j.candle_close_time<=b.last_closed
   and j.candle_close_time>=b.last_closed-2015*300000
  group by s.symbol
 )
 select pg_catalog.jsonb_build_object(
  'ok',true,'mode','PAPER_CANDLE_JOURNAL','source','ATOMIC_PAPER_COMMIT_ONLY',
  'generatedAt',now(),'expected24h',288,'expected7d',2016,
  'recordsBeginAt', (select min(committed_at) from public.trading_paper_candle_journal where portfolio_id=p_portfolio),
  'markets',coalesce((select jsonb_agg(pg_catalog.jsonb_build_object(
   'symbol',symbol,'recorded24h',recorded24,'recorded7d',recorded7d,
   'lastPaperCandle',last_paper_candle,'firstCommitAt',first_commit_at)
   order by symbol) from counts),'[]'::jsonb),
  'limitations','Unrecorded candle slots are unknown, not proven server downtime; first journal record starts at deployment and no history was backfilled.',
  'realOrdersEnabled',false,'autoPromotionEnabled',false);
$$;
revoke all on function public.trading_paper_journal_report(text) from public,anon,authenticated;
grant execute on function public.trading_paper_journal_report(text) to service_role;
