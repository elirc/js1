# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Loose values could reach string operations or SQL, page requests could land beyond the result set, and repeated status commands created misleading history.

**After:** Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. The synchronous in-memory repository changes a record and appends history together within one process.

## Predict this example

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Intake to Discovery, then repeat Discovery: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones Astra changed (compare `AstraOrganized2/astrafinalplan/implementation/batch04/backups/51/server/server.js` with `diff --strip-trailing-cr -w`). `setStatus` (line 290) no longer delegates to `update`, so a repeated status writes nothing and a real change writes exactly one `status` entry together with the record; `validateItem` gained the finite, nonnegative amount check (line 147) and `validDate` (line 349) rejects calendar-impossible dates. The linked source is authoritative if you later edit the project.

```javascript
    setStatus(id, status) {
      const existing = this.find(id);
      if (!existing) return null;
      if (existing.status === status) return existing;
      const updated = { ...existing, status, updatedAt: now() };
      const entry = activityEntry(
        id,
        "status",
        "Changed status from " + existing.status + " to " + status,
      );
      items = items.map((item) => (item.id === id ? updated : item));
      activity.unshift(entry);
      return updated;
    },

// validateItem, server/server.js:147
    return res.status(400).json({ error: "Amount must be zero or greater." });
  req.body = input;
  next();

// server/server.js:349
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A status command expresses a desired value. If a legal case tracker record is already Discovery, setting it to Discovery again is not another business event. Compare the current value before writing. This makes retries easier to reason about, but it does not mean every create request is idempotent: repeating POST can still create a second record.

A date such as 2028-02-29 is a calendar label. Validate its shape and compare its parsed calendar components; 2027-02-29 has the right shape but is not a real day. Activity timestamps are instants and have different semantics. Amounts must be finite, nonnegative numbers: `server/server.js` checks `Number.isFinite(input.amount) && input.amount >= 0` and nothing else, so a value such as 12.505 is stored exactly as sent. Rounding or rejecting fractional cents is a proposed exercise in chapter 5, not implemented behavior. This scaffold does not perform external billing or legal casework.

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. Synchronous array operations cannot interleave midway through an await because there is no await in that boundary. This explanation is specific to one process. Adding disk I/O or multiple API instances requires a new coordination design.

## Three variations to work through

**Normal variation — a real edit.** `PUT /api/cases/:id` with the full valid fixture but `priority: "High"`. Predict: 200, the returned record has `priority: "High"`, a new `updatedAt`, and `GET /activity` shows one more `updated` entry; `status` is unchanged. Run it and confirm the entry count moved by exactly one.

**Invalid variation — an impossible date.** `PUT` the same record with `dueDate: "2027-02-29"`. Predict: 400 with `Use a real date in YYYY-MM-DD format.`, and `GET /api/cases/:id` deep-equals the record from before the edit (the test in `test/workflow.test.js` does exactly this comparison). Count activity entries before and after: zero writes must have happened.

**Boundary variation — the same status twice, at once.** Send two `PATCH /status` requests with `{ status: "Discovery" }` in a `Promise.all`. Predict: both 200, exactly one `status` activity entry, `updatedAt` set once. Then `PATCH` with `{ status: "Unknown" }`: 400 and nothing written. Explain why the synchronous body of `setStatus` makes the first case safe in one process, and what a PostgreSQL version would need (`SELECT ... FOR UPDATE` or a conditional `UPDATE ... WHERE status <> $1`) to keep the same guarantee.

## Executable examples

These are the actual regression tests in [test/workflow.test.js](../test/workflow.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application, request } from "./http.js";
let h;
before(async () => {
  h = await application();
});
after(async () => {
  if (h) await h.close();
});
const route = "/api/cases",
  statuses = ["Intake", "Discovery", "Negotiation", "Closed"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "Contract",
  status: statuses[0],
  amount: 12.5,
  priority: "Medium",
  dueDate: "2028-02-29",
  notes: "A controlled regression fixture",
};
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);

test("valid records round-trip and malformed edits leave the stored record intact", async () => {
  const made = await call(route, "POST", valid);
  assert.equal(made.status, 201);
  assert.equal(made.data.dueDate, "2028-02-29");
  for (const bad of [
    { title: 44 },
    { title: "x".repeat(201) },
    { dueDate: "2027-02-29" },
    { priority: "Unknown" },
    { notes: {} },
    { amount: null },
  ]) {
    assert.equal(
      (await call(route + "/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
      JSON.stringify(bad),
    );
  }
  assert.deepEqual((await call(route + "/" + made.data.id)).data, made.data);
  assert.equal(
    (
      await call(route + "/" + made.data.id + "/activity", "POST", {
        body: { bad: true },
      })
    ).status,
    400,
  );
});
test("equal sort keys give stable pages and an out-of-range page retains real totals", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await call(route, "POST", { ...valid, title: "Astrafixture shared" }))
        .status,
      201,
    );
  const filter = "?search=Astrafixture&sort=title&dir=asc&pageSize=2";
  const first = (await call(route + filter + "&page=1")).data,
    again = (await call(route + filter + "&page=1")).data;
  assert.equal(first.total, 3);
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  const last = (await call(route + filter + "&page=999")).data;
  assert.equal(last.total, 3);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const empty = (await call(route + "?search=absolutelyabsentfixture&page=999"))
    .data;
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
  const fraction = (await call(route + "?page=1.5&pageSize=Infinity")).data;
  assert.equal(fraction.page, 1);
  assert.equal(fraction.pageSize, 6);
});
test("repeated status requests produce one history entry for the actual change", async () => {
  const made = await call(route, "POST", valid),
    path = route + "/" + made.data.id;
  const responses = await Promise.all([
    call(path + "/status", "PATCH", { status: statuses[1] }),
    call(path + "/status", "PATCH", { status: statuses[1] }),
  ]);
  assert.deepEqual(
    responses.map((x) => x.status),
    [200, 200],
  );
  const entries = (await call(path + "/activity")).data;
  assert.equal(entries.filter((x) => x.kind === "status").length, 1);
  assert.equal((await call(path)).data.status, statuses[1]);
  assert.equal(
    (await call(path + "/status", "PATCH", { status: "Unknown" })).status,
    400,
  );
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
