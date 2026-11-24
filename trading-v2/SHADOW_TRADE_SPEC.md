# Prospective Shadow Trades — V1 (paper-only)
This module is intentionally isolated from the live paper portfolio. It DOES NOT send orders to exchanges, request API keys or promote experimental strategies.

## Fixed experiment
- Version: `shadow-v1-20261124`; Supabase `trading_shadow_studies.started_at` is the point after which research inputs may be collected.
- Markets: BTCUSDT / ETHUSDT / SOLUSDT. Four **predefined** scenarios from `entry-filter-research.js`: reference, trend confirmed, minimum ATR volatility, and combined.
- Signals derive exclusively from completed 5-minute OHLC candles, EMA9/21, RSI14 and ATR14. The candidate is long-only. **There are no short orders.**
- No simulated entry is permitted until the OPEN of the first whole candle **following the recorded observation**. Binance's next candle often opens before the HTTP response arrives; there is no retrospective fill at an already-passed open.
- Entry fill: eligible candle open times (1 + 5 bps slippage). Stop: signal close less max(ATR14×2.5, price×0.2%). Target: entry plus 2×(entry−stop). A 30-minute cooldown applies after exit.
- If both target and stop are inside the same OHLC candle, **STOP wins**. Gap-down stop fills at the worse of candle open and stop. If still open after 24 bars (2 hours), close at the 24th bar close.
- Exit fill uses minus 5 bps slippage. Trading fees are 10 bps of notional on both sides. Each trade sizes at a maximum of 1% estimated risk and 50% notional exposure against an **independent fixed $10,000 virtual reference per scenario**. No compounding, margin, leverage or account cash reconciliation.
- An active trade missing any intervening candle is INVALIDATED and explicitly excluded from realized P&L, since the stop path is unknowable. Cold starts do not backfill orders from earlier candles.
- All journals are written by a PostgreSQL trigger on validated forward-only observations inside the same database transaction. Unique constraints and row locks prevent duplicate active positions.
- Public web API `GET /api/shadow-trades` is **read-only**. Only the server has Supabase credentials; RLS denies anon/authenticated access to study, candle and trade tables. No client can place a trade.

## Limitations
These are hypothetical fills from completed five-minute OHLC records, **not broker executions**. They do not model exchange order book depth, queue priority, live spreads, partial fills, brokerage limits, funding or market impact. Stops are approximate when the actual price path inside one candle is unknown. This experimental P&L is **not** the main portfolio's P&L and is NOT evidence of a profitable trading strategy. Paper engine `paper.js` and its existing limits are unchanged.

## Validation
The build executes Node's `node --test *.test.js` suite. Separate Supabase transaction checks validate conservative stop-first behavior, target realization and refusal of signals not observed before an opening. Those checks run inside `BEGIN...ROLLBACK` and never persist synthetic trades.
