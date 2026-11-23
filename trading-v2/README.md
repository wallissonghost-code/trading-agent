# Trading Agent V2 — Preview

This independent preview is hosted as **trading-agent** on Render. The original FUT Live system remains untouched on the `main` branch.

## Run locally

```bash
cd trading-v2
npm start
```

## API

- `GET /health` — health indicator
- `GET /api/status` — mock agent status and P&L
- `GET /api/agents` — mock agent list
- `GET /api/market` — synthetic prices

**Safety:** Mock-only data. No Binance account connection, real quotes, trade signals, real orders or credential handling. Not financial advice. All data are synthetic. Memory resets when service restarts.
