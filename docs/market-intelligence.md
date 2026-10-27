# Project X Market Intelligence

This additive module keeps the existing Project X Operating Systems dashboard and adds a separate `/market-intelligence` workspace.

## Server configuration

Set these values in Render Dashboard → `project-x-platform-live` → Environment. Do not add keys to browser code, commit them, or paste them into source files.

- `TWELVE_DATA_API_KEY`: Twelve Data market-data access.
- `MASSIVE_API_KEY`: Massive market-data access. Massive requests use a date range.
- `OANDA_API_TOKEN`: OANDA v20 market-data access.
- `OANDA_ENVIRONMENT`: `practice` by default; set `live` only when the account is intentionally configured for live market data. This module does not submit orders.
- `GROQ_API_KEY`: Groq analyst access. The implementation uses `openai/gpt-oss-120b` and submits only the selected symbol, candle summary, and OHLC structure evidence.

The status endpoint returns only configured/not-configured status and never returns credentials. When first testing, connect one provider and Groq. Add the remaining providers when their keys are ready. Render restarts the service after environment changes.

## API

- `GET /api/market/status`: provider and analyst configuration status.
- `GET /api/market/candles?provider=twelve-data&symbol=EUR/USD&interval=1h&count=100`: fetch, validate and persist candles. Massive also requires `from=YYYY-MM-DD&to=YYYY-MM-DD`.
- `GET /api/market/structure?...`: confirmed-fractal OHLC heuristic output.
- `POST /api/market/analyst`: JSON body with `provider`, `symbol`, `interval`, `count`, and Massive `from`/`to` when applicable.

Postgres persistence uses a new additive `market_candles` table and leaves existing `product_records` data untouched. If `DATABASE_URL` is not configured, the market API still works but candles are not persisted.

The structure result is an OHLC heuristic. Groq output is an advisory summary of supplied evidence; it is not a forecast guarantee, investment advice, or an order.

## Local verification

Run `npm ci` followed by `npm test`. All provider tests use mocked fetch responses and never call external providers.