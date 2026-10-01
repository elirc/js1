# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

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

## Existing implementation

The series generates every requested calendar day, left-joins daily aggregates, fills missing values with zero and computes the moving average and cumulative total over those rows. Summary uses the same inclusive day window.

The key model is: Raw events are timestamped facts with event type, product and purchase amount. Daily aggregates and materialized views are derived data. The chart returns one row per calendar date; a missing event row becomes a zero-valued day rather than disappearing.

The worked fixture should behave as follows: For daily revenue values 10, 0 and 30 (the test inserts 100 four days ago outside the window, then 10 two days ago and 30 today), the visible seven-day moving averages are 10, 5 and 13.33; cumulative totals are 10, 10 and 40; deltas are null, -10 and 30. A three-day request returns three rows even though events exist on only two of those days.

## Extension solutions

### Exercise 1

**Prompt:** Add a tooltip that distinguishes zero activity from loading.

**Approach:** Use request state for loading and a numeric zero for a completed empty day. Do not use a falsy check that hides zero.

**Review:** the nonzero-day average must be computed in SQL from the same window, and the test must show both numbers for the shipped fixture (13.33 and 20 on day 3).

### Exercise 2

**Prompt:** Compare an average with and without zero days.

**Approach:** Compute (10+0+20)/3 versus (10+20)/2 and explain that they answer different questions.

**Review:** `staleSeconds` must come from `MAX(occurred_at)` versus the refresh timestamp stored at refresh time; the test must observe positive then zero.

### Exercise 3

**Prompt:** Add an explicit materialized-view freshness indicator.

**Approach:** Store/display the last completed refresh time and leave it unchanged on refresh failure.

**Review:** the midnight test must use explicit UTC instants and assert two different day buckets; document the timezone of the buckets.

### Exercise 4

**Prompt:** Offer an optional moving-average warm-up period.

**Approach:** Fetch six preceding days for calculation, compute the window, then trim the displayed range. Document the changed first-point semantics and test them.

**Review:** the cents aggregate must be `ROUND(SUM(amount) * 100)::bigint`, the test must compare integers, and the float `revenue` must remain for the UI.

### Exercise 7 — ownership and authorization

Reference: add `tenant_id text NOT NULL` to `events`, rebuild `daily_metrics` grouped by `(tenant_id, day)`, and add `WHERE tenant_id = $1` to the daily query. `REFRESH` still rebuilds the whole view; say why that is acceptable here and what a per-tenant refresh would need.

Review: the tenant must come from the header, never from the body, and the test must prove isolation in both directions.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/feature.test.ts](../test/feature.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: A chart based only on existing event dates omitted quiet days, so a seven-row average could cover more than seven calendar days. I changed the implementation so that: The series generates every requested calendar day, left-joins daily aggregates, fills missing values with zero and computes the moving average and cumulative total over those rows. Summary uses the same inclusive day window. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
