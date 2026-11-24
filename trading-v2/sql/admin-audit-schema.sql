-- Trading Agent V2: server-only append-only operational admin access trail.
-- No token/IP/user-agent/portfolio state is stored. This is not a complete tamper-proof audit ledger.
create table if not exists public.trading_admin_access_audit (
 id bigint generated always as identity primary key,
 portfolio_id text not null default 'main' check (length(portfolio_id) between 1 and 80),
 event_type text not null check (event_type = 'ADMIN_REVIEW_ACCESS'),
 outcome text not null check (outcome in ('AUTHORIZED','UNAUTHORIZED','NOT_CONFIGURED')),
 route text not null check (route = 'gap-review'),
 occurred_at timestamptz not null default now()
);
create index if not exists trading_admin_access_audit_recent
 on public.trading_admin_access_audit (portfolio_id,occurred_at desc,id desc);
alter table public.trading_admin_access_audit enable row level security;
revoke all on table public.trading_admin_access_audit from public, anon, authenticated;
revoke all on table public.trading_admin_access_audit from service_role;
grant select,insert on table public.trading_admin_access_audit to service_role;
revoke all on sequence public.trading_admin_access_audit_id_seq from public,anon,authenticated;
grant usage,select on sequence public.trading_admin_access_audit_id_seq to service_role;
create or replace function public.trading_deny_admin_audit_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
 raise exception 'Trading admin audit is append-only'
   using errcode = '42501';
end;
$$;
revoke execute on function public.trading_deny_admin_audit_mutation() from public,anon,authenticated;
drop trigger if exists trading_admin_audit_block_update_delete on public.trading_admin_access_audit;
create trigger trading_admin_audit_block_update_delete
 before update or delete on public.trading_admin_access_audit
 for each row execute function public.trading_deny_admin_audit_mutation();
drop trigger if exists trading_admin_audit_block_truncate on public.trading_admin_access_audit;
create trigger trading_admin_audit_block_truncate
 before truncate on public.trading_admin_access_audit
 for each statement execute function public.trading_deny_admin_audit_mutation();
comment on table public.trading_admin_access_audit is 'Server-only operational trail. Append-only via grants and triggers; privileged DB administrators retain control. No financial mutations.';
