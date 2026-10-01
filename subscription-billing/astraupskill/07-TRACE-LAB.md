# Trace lab: Subscription Billing: dependable record editing

[Course index](README.md) · [Worked change](03-WORKED-CHANGE.md) · [Tests](04-TESTING-AND-DEBUGGING.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## The concrete case

This lab connects one visible action to the code that accepts or rejects it. Use a disposable dataset and write your prediction before running the operation. The goal is to explain what each boundary contributes, not to memorize a sequence of clicks.

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Trial to Active, then repeat Active: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

## Write the record before touching the form

The main record represents a customer subscription, plan category, renewal date and billing amount. Shared fields include id, title, owner, category, status, priority, amount, dueDate and notes. Statuses are Trial, Active, Past Due, Cancelled. Categories are Starter, Growth, Enterprise, Internal. Activities reference the record ID. PostgreSQL stores records and activities; API mappers convert snake_case columns to camelCase JSON.

Make a small table in your own notes with these columns: field, starting value, proposed value, and source of truth. Include identity even when the form does not display it. Include related rows or stored counters when the operation changes more than one fact. Mark a value as derived if the app recomputes it rather than storing it independently.

For example, an edit can change a title while preserving an ID. A status command can keep the same status while producing no new history. An import can contain many rows yet be rejected before any replacement begins. In each case, the meaningful observation is the promised resulting state. A success toast alone cannot establish which fields changed.

## Trace the real call path

### Boundary 1 — the React form or status button decides what to send

`client/src/App.tsx`: `save` (line 113) sends the whole `form` object through `createItem` or `updateItem` depending on `editingId`; `changeStatus(item, status)` (line 125) sends only the new status. Both wrap the call in `try/catch` and hand failures to `report(error)`, which is where the server's `error` text becomes the message you see. No field is validated in the browser beyond input types; `amount` leaves the form as whatever the number input produced.

### Boundary 2 — the client serializes the operation as an HTTP request

`client/src/api.ts`: `updateStatus(id, status)` builds `PATCH /api/subscriptions/:id/status` with body `{ status }`; `updateItem` builds `PUT /api/subscriptions/:id` with the full `NewItem`. The generic `request<T>()` sets `Content-Type: application/json`, returns `null` on 204 and throws `new Error(data.error || "Request failed.")` on any non-2xx. The TypeScript types in `shared/types.ts` describe the wire shape, but they are erased at runtime: nothing here guarantees the server receives numbers where it expects them.

### Boundary 3 — the route parses and validates runtime input

`server/src/index.ts:30` `app.param("id")` rejects anything that is not a UUID with 400 before any handler runs. The PATCH route (line 186) checks `STATUSES.includes(req.body?.status)` and throws `ValidationError`; create and full edit call `parseItem` (line 326), which type-checks every field, runs `validDate`, applies the priority allowlist, normalizes, then enforces title/owner length, status, category, the finite nonnegative range and the whole-cent rule. `asyncRoute` forwards a thrown `ValidationError` to the error middleware, which maps it to 400; anything else becomes 500.

### Boundary 4 — the repository applies the change inside one transaction

The PATCH handler calls `withTransaction` (`server/src/db.ts:22`). Inside it, `SELECT * FROM items WHERE id=$1 FOR UPDATE` (line 195) locks the row, so a second concurrent PATCH waits here. If the locked row already has the requested status the callback returns it unchanged: no `UPDATE`, no activity row. Otherwise `UPDATE items SET status=$1, updated_at=now()` and `INSERT INTO activity_entries (... 'status' ...)` run on the same client. Compare with the PUT route (line 149), which updates every column and always records an `updated` entry.

### Boundary 5 — the storage boundary commits or rolls back

`withTransaction` issues `BEGIN`, runs the callback, then `COMMIT`; any throw triggers `ROLLBACK` and re-throws, and the client is released in `finally`. The fourth test proves the boundary: a `BEFORE INSERT` trigger on `activity_entries` makes the audit insert fail, the route answers 500, and the record is byte-for-byte unchanged, because the `UPDATE` in the same transaction was rolled back. The `numeric(12,2)` column and the `CHECK` constraints in `server/db/schema.sql` are the last line of defense if `parseItem` is bypassed.

### Boundary 6 — the response tells the client what actually happened

The handler answers `res.json(toItem(updated))` (200), or 404 `{ error: "Record not found." }` when the locked select found nothing. `toItem` converts `due_date` and `numeric` strings back into the wire shape. In the browser `changeStatus` then calls `refresh()` and re-fetches the activity list, so what you see is a fresh read of committed rows, not the PATCH response.

## Predict the regression scenarios

| Scenario from the executable suite | Prediction to write before running |
|---|---|
| valid records round-trip and malformed edits leave the stored record intact | Initial records, request/input, expected result, and records that must remain unchanged. |
| equal sort keys give stable pages and an out-of-range page retains real totals | Initial records, request/input, expected result, and records that must remain unchanged. |
| repeated status requests produce one history entry for the actual change | Initial records, request/input, expected result, and records that must remain unchanged. |
| a failed activity insert rolls back the status update | Initial records, request/input, expected result, and records that must remain unchanged. |

Open the test file and identify the arrange, act and assert portions. Arrange creates the synthetic starting state. Act calls the real boundary. Assert reads the observable result. Some tests repeat a call or issue two calls together; explain why a single ordinary call would miss that defect. Tests may share a deliberate fixture within one suite, so read setup and earlier scenario state before copying one case into a standalone script.

## A successful request, described precisely

Start with a valid fixture from the test. Copy the values into your own learning notes rather than copying a personal record. State which fields are required, which may be omitted and which have a special meaning when empty. Execute the operation once. Compare the response with a fresh authoritative read, then compare the UI with that read. If the UI is still loading, wait for the actual expected condition instead of guessing a fixed delay.

Record the stable ID and one changed field. Record at least one field that must remain the same. If the operation creates a child, record the parent ID stored on the child. If it updates an aggregate, compute the expected aggregate by hand. If it restores a backup, count retained, ignored and recreated records according to this project’s documented policy. These observations make a small example reusable when the implementation changes.

## A rejected request, described precisely

Now change one value to a rejected case named in the test suite. Keep everything else identical. Predict where validation fails. Run it and capture both the feedback and the authoritative state afterward. Compare the saved record, related rows and relevant counters with their pre-request values. A controlled error is useful only if the application also preserves the intended state.

Do not assume that all failures have the same status or message. Invalid input, missing records, conflicts and infrastructure errors represent different conditions. Read this app’s handler or parser to see the actual result. Browser-only parsers return a success/error union or throw an import error rather than returning an HTTP status. Translate the same correctness idea into the contract this app actually exposes.

## Read the storage boundary

Read [test/database.ts](../test/database.ts). PostgreSQL owns persistent rows; a unique search_path isolates each test schema. Failure triggers are created only inside that schema. If a process is interrupted, inspect its exact schema name before cleanup. The course never requires personal application data.

Place a breakpoint immediately before the first write and another after the final write or publish step. On the success path, note what changed between those points. On the rejected-input path, the first write should never be reached when validation promises pre-write rejection. On a transactional failure path, some statements may execute and then roll back; reaching a write statement does not mean its effect committed.

An await marks a place where another operation can run. It does not itself define a transaction. When the test uses Promise.all, sketch request A and request B in two columns. Show where each acquires a lock or reads state. The test should accept either winner while insisting on the same final invariant. For synchronous or browser-only validation, explain why concurrency is outside the tested function rather than borrowing a database explanation that does not apply.

## Explain the design tradeoff

A status command expresses a desired value. If a subscription billing record is already Active, setting it to Active again is not another business event. Compare the current value before writing. This makes retries easier to reason about, but it does not mean every create request is idempotent: repeating POST can still create a second record.

A date such as 2028-02-29 is a calendar label. Validate its shape and compare its parsed calendar components; 2027-02-29 has the right shape but is not a real day. Activity timestamps are instants and have different semantics. Amounts must be finite, nonnegative, whole-cent values: `parseItem` in `server/src/index.ts` checks `Number.isFinite`, the range, and that `amount * 100` is a whole number, so 12.345 is rejected with 400 (`Amount must be whole cents.`) instead of being silently rounded by the `numeric(12,2)` column. This scaffold does not perform real payment processing.

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. A repeatable-read transaction keeps the count and rows from describing different database snapshots. The status transaction acquires a row lock before comparing status: a competing request waits, then sees the newly committed value. Both UPDATE and activity INSERT must use the same transaction client.

## Change one requirement independently

**Practice task:** Add a visible due-soon filter with a precisely defined date window.

Before implementation, write three acceptance criteria: an ordinary successful case, a rejected or cancelled case, and a case that preserves existing behavior. Identify the smallest file boundary that owns the rule. Keep the existing regression suite; add a test only when it observes a new promise. Do not reproduce the implementation line by line inside the assertion, because both copies can contain the same mistake.

After a first attempt, compare your design with this hint: Compare valid calendar labels against today and a documented inclusive end date; preserve other filters and reset or clamp pagination.

## Debug a disagreement between layers

If the form and response disagree, inspect the request payload before editing the database code. If the response and database disagree, inspect the mapper, transaction and read query. If a test fails before an HTTP request is logged, inspect startup, environment variables and the test fixture. Missing dependencies, a busy port or an unavailable database are different from a failed business assertion. Preserve the first useful error and fix that cause before interpreting later cascading failures.

When a date looks wrong, distinguish a calendar label from an instant and check the serialization boundary. When an optional field will not clear, distinguish omission from an explicit empty/null value. When a list seems to lose a record, inspect filtering, sorting and pagination before assuming deletion. When history duplicates, compare desired-state commands with commands that represent a new event. These are diagnostic questions to apply to the actual fields above.

## Final independent checkpoint

Close this guide and give a five-minute walkthrough using only the application source and one test. Explain the user-visible problem, the input contract, the identity model, the write boundary, a failed operation and the remaining limitation. Then modify the worked fixture and predict the result without running it. Reopen the guide only after writing your answer.

A useful review note includes the exact command run, its result, and the boundary it covers. Keep browser interaction, simulated storage tests, real HTTP/database tests and compile checks distinct. The [verification page](VERIFICATION.md) records this delivery’s evidence. Exercises and proposed extensions in this course remain learner work; they are not counted as implemented features.
