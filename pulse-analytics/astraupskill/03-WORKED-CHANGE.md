# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** A chart based only on existing event dates omitted quiet days, so a seven-row average could cover more than seven calendar days.

**After:** The series generates every requested calendar day, left-joins daily aggregates, fills missing values with zero and computes the moving average and cumulative total over those rows. Summary uses the same inclusive day window.

## Predict this example

For daily revenue values 10, 0 and 30 (the test inserts 100 four days ago outside the window, then 10 two days ago and 30 today), the visible seven-day moving averages are 10, 5 and 13.33; cumulative totals are 10, 10 and 40; deltas are null, -10 and 30. A three-day request returns three rows even though events exist on only two of those days.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 23. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
app.get("/api/metrics/daily", asyncRoute(async (req, res) => {
  const days = clampDays(req.query.days);
  const rows = await query<{
    day: string;
    views: string;
    carts: string;
    orders: string;
    revenue: string;
    revenue_ma7: string;
    revenue_cumulative: string;
    revenue_delta: string | null;
  }>(
    `WITH calendar AS (
       SELECT generated::date AS day FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') generated
     ), filled AS (
       SELECT c.day, COALESCE(m.views,0) AS views, COALESCE(m.carts,0) AS carts,
         COALESCE(m.orders,0) AS orders, COALESCE(m.revenue,0) AS revenue
       FROM calendar c LEFT JOIN daily_metrics m ON m.day=c.day
     )
     SELECT to_char(day,'YYYY-MM-DD') AS day, views, carts, orders, revenue,
       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW),2) AS revenue_ma7,
       SUM(revenue) OVER (ORDER BY day) AS revenue_cumulative,
       revenue - LAG(revenue) OVER (ORDER BY day) AS revenue_delta
     FROM filled ORDER BY day`,
    [days]
  );

  const metrics: DailyMetric[] = rows.map((row) => ({
    day: row.day,
    views: Number(row.views),
    carts: Number(row.carts),
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    revenueMa7: Number(row.revenue_ma7),
    revenueCumulative: Number(row.revenue_cumulative),
    revenueDelta: row.revenue_delta === null ? null : Number(row.revenue_delta)
  }));
  res.json(metrics);
}));

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

SQL GROUP BY only produces groups present in the input. If Monday has 10 purchases and Wednesday has 20, Tuesday does not exist in the grouped result. generate_series supplies the calendar spine. LEFT JOIN keeps Tuesday, and COALESCE converts the missing aggregate to zero. Only then does a ROWS window correspond to calendar days. The order of these operations is part of correctness.

The first moving-average points use the available rows inside the requested window; the first point is a one-day average, not a hidden seven-day warm-up. Cumulative totals also reset at the requested window boundary, and the first delta is null because there is no preceding row in that result. Summary and series share inclusive calendar-day boundaries. The separate top-products query retains a rolling timestamp window. Refreshing a materialized view is an explicit update to a stored derived result; newly inserted raw events can exist before that view reflects them.

## Three variations to work through

- **Normal variation — the shipped fixture.** Insert 100 four days ago, 10 two days ago, 30 today; refresh; `?days=3`. Predict revenue `[10, 0, 30]`, cumulative `[10, 10, 40]`, moving average `[10, 5, 13.33]`, delta `[null, -10, 30]` (first test).

- **Invalid variation — a purchase with no amount.** `POST /api/events` with `{ name: "purchase", product: "x" }`: predict 400 `Purchase amount must be a number.` and no row (second delivered test). With `name: "refund"`: predict the vocabulary message first (new test).

- **Boundary variation — two refreshes.** In `psql`, `BEGIN; REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics;` and leave the transaction open; call `POST /api/metrics/refresh`: predict 409 after about two seconds. `COMMIT` and call again: 200.

## Executable examples

These are the actual regression tests in [test/feature.test.ts](../test/feature.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, request } from "./database.js";
let h;
before(async () => {
  h = await database();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
test("daily analytics fill missing calendar days and include exactly the requested window", async () => {
  await h.admin.query("TRUNCATE events");
  await h.admin.query(
    "INSERT INTO events(name,product,amount,occurred_at) VALUES ('purchase','Fixture',100,CURRENT_DATE-3),('purchase','Fixture',10,CURRENT_DATE-2),('purchase','Fixture',30,CURRENT_DATE)",
  );
  assert.equal((await call("/api/metrics/refresh", "POST", {})).status, 200);
  const daily = (await call("/api/metrics/daily?days=3")).data;
  assert.equal(daily.length, 3);
  assert.deepEqual(
    daily.map((x) => x.revenue),
    [10, 0, 30],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueCumulative),
    [10, 10, 40],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueMa7),
    [10, 5, 13.33],
  );
  assert.deepEqual(
    daily.map((x) => x.revenueDelta),
    [null, -10, 30],
  );
  const summary = (await call("/api/metrics/summary?days=3")).data;
  assert.equal(summary.revenue, 40);
  assert.equal(summary.orders, 2);
});
test("invalid event values never reach the raw event table", async () => {
  const before = Number(
    (await h.admin.query("SELECT COUNT(*) AS n FROM events")).rows[0].n,
  );
  for (const body of [
    { name: "purchase", product: "Fixture", amount: "Infinity" },
    { name: "purchase", product: "Fixture", amount: null },
    { name: "view", product: {} },
    { name: "unknown", product: "Fixture" },
  ])
    assert.equal((await call("/api/events", "POST", body)).status, 400);
  assert.equal(
    Number((await h.admin.query("SELECT COUNT(*) AS n FROM events")).rows[0].n),
    before,
  );
});
test("freshness reports the gap between raw events and the refreshed view", async () => {
  const added = await call("/api/events", "POST", {
    name: "view",
    product: "Fixture",
    amount: 0,
  });
  assert.equal(added.status, 201);
  assert.equal(added.data.stale, true);
  const refreshed = await call("/api/metrics/refresh", "POST", {});
  assert.equal(refreshed.data.stale, false);
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
