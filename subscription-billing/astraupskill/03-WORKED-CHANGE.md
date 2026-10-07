# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Loose values could reach string operations or SQL, page requests could land beyond the result set, and repeated status commands created misleading history.

**After:** Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. A row lock and transaction commit the status and activity together; count and page rows use one repeatable-read snapshot. Currency inputs accept cent increments in the browser.

## Predict this example

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Trial to Active, then repeat Active: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones that changed (run `git diff -w 606e0e6 -- server/src/index.ts` from this project folder): the PATCH route now locks the row with `FOR UPDATE`, returns early on a no-op status, and writes the update and its audit row in one transaction; `parseItem` gained the finite/range check and, in this course's fix pass, the whole-cent rule. The linked source is authoritative if you later edit the project.

```typescript
app.patch(
  "/api/subscriptions/:id/status",
  asyncRoute(async (req, res, next) => {
    try {
      const status = req.body?.status;
      if (!STATUSES.includes(status))
        throw new ValidationError("Choose a valid status.");
      const updated = await withTransaction(async (client) => {
        const current = await client.query<ItemRow>(
          "SELECT * FROM items WHERE id=$1 FOR UPDATE",
          [req.params.id],
        );
        if (!current.rows[0]) return null;
        if (current.rows[0].status === status) return current.rows[0];
        const result = await client.query<ItemRow>(
          "UPDATE items SET status=$1, updated_at=now() WHERE id=$2 RETURNING *",
          [status, req.params.id],
        );
        await client.query(
          "INSERT INTO activity_entries (item_id,kind,body) VALUES ($1,'status',$2)",
          [
            req.params.id,
            "Changed status from " + current.rows[0].status + " to " + status,
          ],
        );
        return result.rows[0]!;
      });
      if (!updated) return res.status(404).json({ error: "Record not found." });
      res.json(toItem(updated));
    } catch (error) {
      next(error);
    }
  }),
);


// parseItem, server/src/index.ts:374
  if (
    !Number.isFinite(item.amount) ||
    item.amount < 0 ||
    item.amount > 9999999999.99
  )
    throw new ValidationError("Amount must be zero or greater.");
  // Whole cents only: the numeric(12,2) column would otherwise round 12.345 silently.
  if (Math.abs(item.amount * 100 - Math.round(item.amount * 100)) > 1e-6)
    throw new ValidationError("Amount must be whole cents.");
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A status command expresses a desired value. If a subscription billing record is already Active, setting it to Active again is not another business event. Compare the current value before writing. This makes retries easier to reason about, but it does not mean every create request is idempotent: repeating POST can still create a second record.

A date such as 2028-02-29 is a calendar label. Validate its shape and compare its parsed calendar components; 2027-02-29 has the right shape but is not a real day. Activity timestamps are instants and have different semantics. Amounts must be finite, nonnegative, whole-cent values: `parseItem` in `server/src/index.ts` checks `Number.isFinite`, the range, and that `amount * 100` is a whole number, so 12.345 is rejected with 400 (`Amount must be whole cents.`) instead of being silently rounded by the `numeric(12,2)` column. This scaffold does not perform real payment processing.

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. A repeatable-read transaction keeps the count and rows from describing different database snapshots. The status transaction acquires a row lock before comparing status: a competing request waits, then sees the newly committed value. Both UPDATE and activity INSERT must use the same transaction client.

## Three variations to work through

**Normal variation — a real edit.** `PUT /api/subscriptions/:id` with the full valid fixture but `priority: "High"`. Predict: 200, `priority` is `High`, `updatedAt` moved, and `GET /activity` has one more `updated` row. Then check `SELECT updated_at FROM items WHERE id=...` in `psql` to see that the timestamp is the database's `now()`, not the client's clock.

**Invalid variation — fractional cents.** `PUT` with `amount: 12.345`. Predict: 400 `Amount must be whole cents.` and the stored row unchanged (deep-equal the GET). Then comment out the whole-cent check, run the same request, and read the row: PostgreSQL's `numeric(12,2)` silently stores 12.35. That silent rounding is why the validation belongs before the write.

**Boundary variation — a failing audit insert.** Reuse the fourth test's trigger (`CREATE TRIGGER fail_lesson_audit BEFORE INSERT ON activity_entries ...`) from `psql` against your dev database, then `PATCH /status` to `Active`. Predict: 500, the record still `Trial`, and one activity row (the seed). Drop the trigger and repeat: 200 and exactly two rows. Explain which line in `withTransaction` made the first outcome all-or-nothing.

## Executable examples

These are the actual regression tests in [test/workflow.test.ts](../test/workflow.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, request } from "./database.js";
let h: Awaited<ReturnType<typeof database>>;
before(async () => {
  h = await database();
});
after(async () => {
  if (h) await h.close();
});
const route = "/api/subscriptions",
  statuses = ["Trial", "Active", "Past Due", "Cancelled"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "Starter",
  status: statuses[0],
  amount: 12.5,
  priority: "Medium",
  dueDate: "2028-02-29",
  notes: "A controlled regression fixture",
};
const call = (path: string, method = "GET", body?: unknown) =>
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
    { amount: 12.345 },
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

test("a failed activity insert rolls back the status update", async () => {
  const made = await call(route, "POST", valid),
    id = made.data.id,
    path = route + "/" + id;
  await h.admin.query(
    `CREATE FUNCTION reject_lesson_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='status' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
  );
  await h.admin.query(
    "CREATE TRIGGER fail_lesson_audit BEFORE INSERT ON activity_entries FOR EACH ROW EXECUTE FUNCTION reject_lesson_audit()",
  );
  try {
    assert.equal(
      (await call(path + "/status", "PATCH", { status: statuses[1] })).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
    assert.equal((await call(path + "/activity")).data.length, 1);
  } finally {
    await h.admin.query("DROP TRIGGER fail_lesson_audit ON activity_entries");
  }
  assert.equal(
    (await call(path + "/status", "PATCH", { status: statuses[1] })).status,
    200,
  );
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
