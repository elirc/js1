# Pulse Analytics - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4117**. Raw `events`
> (view/add_to_cart/purchase) feed a materialized view `daily_metrics`
> (`date_trunc` + `COUNT FILTER`). `server/src/index.ts` layers window functions
> (`AVG OVER ROWS`, `SUM OVER`, `LAG`, `RANK`) and exposes refresh + freshness.
> `shared/types.ts` shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Conversion funnel
**As a** PM, **I want** a view->cart->purchase funnel, **so that** I see drop-off.

### Acceptance criteria
- [ ] `GET /api/metrics/funnel?days=` returns counts at each stage plus stage-to-stage conversion rates.
- [ ] The client renders three funnel bars with percentages.

### Implementation plan
1. **`server/src/index.ts`** - add the route: a single query over `events` in range using `COUNT(*) FILTER (WHERE name='view')` etc.; compute `cartRate = carts/views`, `purchaseRate = orders/carts` in TS (guard divide-by-zero).
2. **`shared/types.ts`** - add a `Funnel` interface.
3. **`client/src/App.tsx`** - add `getFunnel(days)` to `api.ts` and render three proportional bars labeled with counts + rates.

### How to test
With seeded data, confirm views  carts  orders and that the displayed rates equal the ratios.

---

## Story 2: Auto-refresh with a "last refreshed" timestamp
**As a** user, **I want** the view to refresh on a timer, **so that** dashboards stay current.

### Acceptance criteria
- [ ] The server tracks the last refresh time; `GET /api/metrics/freshness` returns it.
- [ ] The client shows "Updated HH:MM:SS ago" and can toggle auto-refresh (e.g. every 30s).

### Implementation plan
1. **`server/src/index.ts`** - keep a module-level `let lastRefreshedAt = new Date().toISOString()`; set it whenever the refresh route runs. Include it in the `freshness()` payload.
2. **`shared/types.ts`** - add `lastRefreshedAt: string` to `Freshness`.
3. **`client/src/App.tsx`** - add an "Auto-refresh" toggle that `setInterval`s `handleRefresh()` (clear on unmount); show the relative time from `lastRefreshedAt`.

### How to test
Enable auto-refresh, add sample events, confirm the dashboard updates within the interval and the "Updated ... ago" label resets.

---

## Story 3: Custom date range
**As an** analyst, **I want** an arbitrary date range, **so that** I'm not limited to 7/30/90.

### Acceptance criteria
- [ ] `from`/`to` query params (dates) constrain `daily`, `summary`, and `top-products`.
- [ ] The client has two date pickers; presets still work.

### Implementation plan
1. **`server/src/index.ts`** - accept optional `from`/`to` in the three endpoints; when present use `WHERE day BETWEEN $from AND $to` (and `occurred_at` for top-products) instead of the `CURRENT_DATE - days` window. Validate that `from <= to`.
2. **`client/src/api.ts`** - pass `from`/`to`.
3. **`client/src/App.tsx`** - add two `<input type="date">`; when both set, use them; otherwise fall back to the preset `days`.

### How to test
Pick a 5-day window mid-dataset, confirm the chart, summary, and leaderboard all reflect exactly that span.

---

## Story 4: Per-product time series
**As an** analyst, **I want** a product's daily revenue, **so that** I can study one SKU.

### Acceptance criteria
- [ ] `GET /api/metrics/product-series?product=&days=` returns daily revenue/orders for one product (with a 7-day moving average).
- [ ] The client shows it when a leaderboard product is clicked.

### Implementation plan
1. **`server/src/index.ts`** - add the route querying raw `events` (not the matview, which isn't per-product): `date_trunc('day', occurred_at)` grouped, filtered to the product, with the same `AVG(...) OVER (ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` moving average.
2. **`client/src/App.tsx`** - make leaderboard rows clickable; fetch and render the product's mini chart in a panel.

### How to test
Click "Widget" in the leaderboard, confirm a daily series scoped to Widget with a smoothed moving-average line.

---

## Story 5: Biggest movers (day-over-day)
**As a** PM, **I want** to see which products spiked, **so that** I can react.

### Acceptance criteria
- [ ] `GET /api/metrics/movers?days=` ranks products by change in revenue between the two most recent comparable periods.
- [ ] Gains and drops are shown with direction and percentage.

### Implementation plan
1. **`server/src/index.ts`** - add the route: aggregate per product for the current window and the immediately preceding window of the same length (two `SUM ... FILTER` subqueries or a `CASE` split by date), compute the delta and percent change in SQL or TS, and order by absolute change. Use `RANK()`/`DENSE_RANK()` to label positions (good place to compare the two - see the README stretch idea).
2. **`shared/types.ts`** + **`client/src/App.tsx`** - add a `Mover` type and a "Biggest movers" panel with up/down arrows and percentages.

### How to test
Add a burst of sample purchases for one product, refresh, confirm it tops the movers list with a positive delta; a quiet product shows a drop.

