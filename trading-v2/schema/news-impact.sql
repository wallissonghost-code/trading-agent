-- Deployment record: executed in Supabase trading-agent project.
-- Adds immutable first-seen observation and noncausal 60-minute outcome study.
alter table public.trading_research_news add column if not exists first_seen_at timestamptz;
update public.trading_research_news set first_seen_at=fetched_at where first_seen_at is null;
alter table public.trading_research_news alter column first_seen_at set not null;
alter table public.trading_research_news drop constraint if exists news_url_safe;
alter table public.trading_research_news add constraint news_url_safe
 check(char_length(url) between 14 and 1024 and url like 'https://%' and url !~ '[[:space:]]');

create table if not exists public.trading_news_price_outcomes (
 portfolio_id text not null,
 source text not null,
 url text not null,
 symbol text not null check(symbol in ('BTCUSDT','ETHUSDT','SOLUSDT')),
 observed_after timestamptz not null,
 baseline_candle_open_time bigint not null,
 baseline_price numeric not null check(baseline_price>0),
 outcome_candle_close_time bigint not null,
 outcome_price numeric not null check(outcome_price>0),
 horizon_minutes integer not null default 60 check(horizon_minutes=60),
 return_pct numeric not null,
 evaluated_at timestamptz not null default now(),
 primary key(portfolio_id,source,url,symbol,horizon_minutes),
 foreign key(portfolio_id,source,url) references public.trading_research_news(portfolio_id,source,url) on delete restrict,
 constraint candle_after_observation check(baseline_candle_open_time >= extract(epoch from observed_after)*1000),
 constraint one_hour_after_baseline check(outcome_candle_close_time >= baseline_candle_open_time + 60*60000 - 1)
);
create index if not exists trading_news_price_outcomes_recent
 on public.trading_news_price_outcomes(portfolio_id,evaluated_at desc);
alter table public.trading_news_price_outcomes enable row level security;
revoke all on public.trading_news_price_outcomes from public,anon,authenticated;
grant select,insert on public.trading_news_price_outcomes to service_role;
