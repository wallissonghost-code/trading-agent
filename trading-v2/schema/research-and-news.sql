-- Applied to the dedicated Trading Agent Supabase project. Research only.
create table if not exists public.trading_research_reports (
 portfolio_id text not null references public.trading_paper_states(id) on delete restrict,
 symbol text not null check(symbol in ('BTCUSDT','ETHUSDT','SOLUSDT')),
 study_kind text not null check(study_kind='WALK_FORWARD_28D_V1'),
 period_end timestamptz not null,
 period_start timestamptz not null,
 completed_at timestamptz not null default now(),
 report jsonb not null check(jsonb_typeof(report)='object'),
 primary key(portfolio_id,symbol,study_kind,period_end),
 constraint positive_study_window check(period_start<period_end)
);
create index if not exists trading_research_latest_idx on public.trading_research_reports(portfolio_id,completed_at desc);
alter table public.trading_research_reports enable row level security;
revoke all on public.trading_research_reports from public,anon,authenticated;
grant select,insert on public.trading_research_reports to service_role;
create table if not exists public.trading_research_news (
 portfolio_id text not null references public.trading_paper_states(id) on delete restrict,
 source text not null check(source in ('CoinDesk','Cointelegraph','Federal Reserve')),
 url text not null,
 title text not null,
 published_at timestamptz not null,
 fetched_at timestamptz not null,
 related_symbols text[] not null default '{}',
 context_category text not null,
 primary key(portfolio_id,source,url),
 constraint news_url_safe check(char_length(url) between 14 and 1024 and url like 'https://%' and url !~ '[[:space:]]')
);
create index if not exists trading_research_news_recent_idx on public.trading_research_news(portfolio_id,published_at desc);
alter table public.trading_research_news enable row level security;
revoke all on public.trading_research_news from public,anon,authenticated;
grant select,insert on public.trading_research_news to service_role;
