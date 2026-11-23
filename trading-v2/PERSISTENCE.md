# Paper state persistence (optional, not yet activated)

The trading-agent preview currently runs on a Render free web service. Its local `/tmp` history is **ephemeral**, not a database. A cold restart, redeploy, or migration can wipe it.

A dedicated Supabase project can store one private portfolio snapshot. Do not reuse unrelated inactive databases.

## Activate

1. Choose or create an active Supabase project and apply `schema/paper.sql` after reviewing it.
2. Set Render Environment variables on the **trading-agent** service only:
   - `SUPABASE_URL` = HTTPS URL of the project.
   - `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) = private server-only secret.
3. Redeploy and confirm `GET /api/paper` contains `persistence: "supabase"`. Never add either secret to browser code or a frontend environment variable.

This storage uses PostgREST with one fixed row `main`. Do not run multiple trading-agent instances against that row. No transactional compare-and-swap exists in this preview. State writes and market data may fail; the engine halts on storage failures instead of silently resetting balances. For operational use, add locking, immutable trade ledger, authenticated dashboards, backups, and reconciliation.

Simulation prices are not real fills. The API remains read-only; there is no key for Binance trading and no order execution.
