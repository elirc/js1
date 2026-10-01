# Trace lab: calendar buckets, window functions and derived data

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/feature.test.ts](../test/feature.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

For daily revenue values 10, 0 and 30 (the test inserts 100 four days ago outside the window, then 10 two days ago and 30 today), the visible seven-day moving averages are 10, 5 and 13.33; cumulative totals are 10, 10 and 40; deltas are null, -10 and 30. A three-day request returns three rows even though events exist on only two of those days.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the dashboard decides what to ask

`client/src/App.tsx`: the window selector sends `?days=N`; the refresh button posts to `/api/metrics/refresh`; the event form posts `{ name, product, amount }`.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `GET /api/metrics/daily`, `GET /api/metrics/freshness`, `POST /api/metrics/refresh`, `POST /api/events`.

### Boundary 3 — `parseEvent` validates vocabulary, then shape

`server/src/index.ts:178`: event name against `EVENT_NAMES` first, then the product text, then the purchase amount (finite, non-negative, bounded).

### Boundary 4 — raw events are inserted; the view is refreshed on demand

`POST /api/events` inserts into `events`; `POST /api/metrics/refresh` (line 150) runs `REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics` under a bounded `lock_timeout`.

### Boundary 5 — PostgreSQL fills the calendar

the daily query joins a generated series of days to the view so empty days appear with zero revenue (second delivered test, and the new seven-day test); moving averages and cumulative totals are window functions over that series.

### Boundary 6 — the response tells the client what happened

`daily` rows with `revenue`, `revenueMa7`, `revenueCumulative`, `revenueDelta`; `freshness` with the gap; 409 when a refresh is already running.

## Expected observations

| Action or input | Expected result |
|---|---|
| Actual test revenue window | 10, 0, 30 |
| Cumulative | 10, 10, 40 |
| Moving average | 10, 5, 13.33 |
| Delta | null, -10, 30 |
| Raw insert then refresh | Stale true, then false |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

SQL GROUP BY only produces groups present in the input. If Monday has 10 purchases and Wednesday has 20, Tuesday does not exist in the grouped result. generate_series supplies the calendar spine. LEFT JOIN keeps Tuesday, and COALESCE converts the missing aggregate to zero. Only then does a ROWS window correspond to calendar days. The order of these operations is part of correctness.

The first moving-average points use the available rows inside the requested window; the first point is a one-day average, not a hidden seven-day warm-up. Cumulative totals also reset at the requested window boundary, and the first delta is null because there is no preceding row in that result. Summary and series share inclusive calendar-day boundaries. The separate top-products query retains a rolling timestamp window. Refreshing a materialized view is an explicit update to a stored derived result; newly inserted raw events can exist before that view reflects them.

Pause near `generate_series` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- daily analytics fill missing calendar days and include exactly the requested window
- invalid event values never reach the raw event table
- freshness reports the gap between raw events and the refreshed view

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
