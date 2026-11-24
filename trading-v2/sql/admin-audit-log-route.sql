-- Permit the server-only audit viewer route; keep both values constrained.
alter table public.trading_admin_access_audit
 drop constraint if exists trading_admin_access_audit_route_check;
alter table public.trading_admin_access_audit
 add constraint trading_admin_access_audit_route_check
 check (route in ('gap-review','audit-log'));
