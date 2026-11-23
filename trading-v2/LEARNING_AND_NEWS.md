# Trading Agent V2 — Learning & News, staged roadmap

Status: SPECIFICATION ONLY. Neither news-driven entries nor automatic strategy changes are active. No real trading.

## 1. Observation and learning pipeline
- Log each decision, including **no-trade**: UTC timestamp, symbol, closed-candle ID, feature values (EMA9, EMA21, RSI14, ATR14), current positions, cash, volatility and strategy version.
- Attribute every paper trade to the exact strategy version and decision that originated it. Store signal, stop, take-profit, fees, assumptions and realized outcome.
- Compute longitudinal performance by symbol, regime, strategy and news category. Include drawdown, average win/loss, expectancy, slippage sensitivity and profit factor.
- Keep a fixed baseline strategy as a control. Train a candidate on historical data, then run walk-forward/time-split tests with holdout data; prohibit temporal leakage, especially candle/news publication timestamps.
- Candidate strategies can only be promoted after enough independent paper trades and stable out-of-sample results. Do not adjust risk limits automatically; keep human approval for material strategy changes.
- A small sample or no closed trades cannot support claims of learning. Display "insufficient data" rather than an invented win rate.

## 2. News collection (future)
- Use licensed, rate-limited sources with publication timestamps and canonical URLs. Avoid scraping without permission.
- Ingest timestamp (published_at and fetched_at), publisher, headline, canonical URL, language, tickers, credibility/reliability metadata, duplicate group and text classification.
- Separate macroeconomic announcements, regulations, exchange announcements and specific-token news.
- NLP scores are **uncertain signals**, not factual verification or trade orders. Check source, freshness, spoofed headlines, contradictory reports and market already pricing in the event.
- For historical testing use only items available **before** the simulated decision, respecting ingestion delay and embargoes. Never backfill news into earlier trades as if it had been known then.
- Fail closed: missing news feeds mean NO news-driven order, not a fabricated positive/negative score.
- Compare market-only baseline against market+news candidates net of fees and simulated slippage. Explain overrides and retain source references.

## 3. Risk boundaries
- Paper-only. Public Binance market data does not imply Binance account access.
- Existing caps (up to 1% estimated risk per entry, max 2 positions, max 50% exposure, 5% drawdown lock) remain fixed; these are approximate and not guarantees.
- News/model suggestions must not bypass stop loss, exposure, risk locks or persistence failures.
- Real-money deployment requires separate security review, authenticated UI, dedicated exchange credentials, more extensive testing, manual authorization and monitoring.

## 4. Current implementation
- `/api/performance` exposes paper-only closed-trade analytics.
- The dashboard draws a **realized-only** equity curve, not a total mark-to-market daily equity history.
- `/api/trade-history` reads the private immutable-event ledger.
- Next coding milestone: decision event journal, outcome attribution, training candidate leaderboard and read-only news ingestion (source selection needed).
