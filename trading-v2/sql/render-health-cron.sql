-- Independent, read-only health pings from existing Supabase pg_cron + pg_net.
-- It does NOT trade, mutate the paper portfolio, or upgrade hosting.
-- The job is idempotent by name. Jobs run in UTC.
-- GitHub schedule remains a separate best-effort backup.
select cron.schedule(
 'trading-agent-render-health-10m',
 '7,17,27,37,47,57 * * * *',
 $job$
 select net.http_get(
   url:='https://trading-agent-4d0a.onrender.com/health',
   headers:='{"Accept":"application/json"}'::jsonb,
   timeout_milliseconds:=30000
 );
 $job$
);
-- To pause: select cron.unschedule('trading-agent-render-health-10m');
-- To audit: SELECT * FROM cron.job_run_details WHERE jobid=(SELECT jobid
-- FROM cron.job WHERE jobname='trading-agent-render-health-10m')
-- ORDER BY start_time DESC LIMIT 20;
-- Network successes are checked separately in net._http_response (default
-- response retention is limited). An enqueued request is not proof of HTTP 200.
