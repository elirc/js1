# Pulse Analytics (TypeScript · React · Node · Postgres)

A metrics dashboard whose lesson is the **read side**: pre-aggregating raw
events into a **materialized view** and layering **window functions** on top —
the analytical SQL the CRUD-focused projects never touch.

## What it teaches

- A **materialized view** (`daily_metrics`) that rolls events up per day with
  `date_trunc` and `COUNT(*) FILTER (WHERE …)`
- Why a materialized view goes **stale**, and `REFRESH MATERIALIZED VIEW
  CONCURRENTLY` (which needs the `UNIQUE` index the schema creates)
- Window functions on the daily series:
  - 7-day moving average — `AVG(...) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`
  - running total — `SUM(...) OVER (ORDER BY day)`
  - day-over-day change — `LAG(...) OVER (ORDER BY day)`
- A leaderboard ranked with `RANK() OVER (ORDER BY revenue DESC)`
- Derived KPIs (conversion, average order value) computed safely against zero

## Try the staleness loop

1. Click **+ Sample events** — the banner shows the view is now behind.
2. Click **Refresh view** — the rollup catches up and the charts move.

This is the central trade-off of materialized views: fast reads, but the data
is only as fresh as the last refresh.

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb pulse_analytics
npm install
npm run db:setup     # seeds ~4000 events and builds the materialized view
npm run dev          # API on :4117, client on :5117
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## Stretch ideas

- Schedule refreshes with `pg_cron`, or refresh on a Node interval.
- Add a funnel (view → cart → purchase) with conditional aggregation.
- Compare `RANK()` vs `DENSE_RANK()` vs `ROW_NUMBER()` on the leaderboard.
