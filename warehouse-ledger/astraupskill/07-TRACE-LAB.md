# Trace lab: Warehouse Ledger: transactions and derived stock

[Course index](README.md) · [Worked change](03-WORKED-CHANGE.md) · [Tests](04-TESTING-AND-DEBUGGING.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, request } from "./database.js";
let h: Awaited<ReturnType<typeof database>>,
  product: string,
  main: string,
  other: string;
before(async () => {
  h = await database();
  product = (await h.admin.query("SELECT id FROM products WHERE sku='SKU-001'"))
    .rows[0].id;
  main = (await h.admin.query("SELECT id FROM warehouses WHERE name='Main'"))
    .rows[0].id;
  other = (
    await h.admin.query("SELECT id FROM warehouses WHERE name='Overflow'")
  ).rows[0].id;
});
after(async () => {
  if (h) await h.close();
});
const api = (path: string, body: unknown) =>
  request(h.origin, "/api/" + path, "POST", body);
test("fractional, nonnumeric, unbounded and malformed quantities leave stock unchanged", async () => {
  const count = await h.admin.query("SELECT count(*) FROM movements");
  for (const delta of [1.2, "3", 0, 2147483648, null])
    assert.equal(
      (await api("movements", { productId: product, warehouseId: main, delta }))
        .status,
      400,
    );
  assert.equal(
    (
      await api("movements", {
        productId: product,
        warehouseId: main,
        delta: 1,
        reason: {},
      })
    ).status,
    400,
  );
  assert.deepEqual(
    (await h.admin.query("SELECT count(*) FROM movements")).rows,
    count.rows,
  );
});
test("two simultaneous issues cannot both spend the same stock", async () => {
  const results = await Promise.all(
    [1, 2].map(() =>
      api("movements", { productId: product, warehouseId: main, delta: -30 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(
    Number(
      (
        await h.admin.query(
          "SELECT sum(delta) AS n FROM movements WHERE product_id=$1 AND warehouse_id=$2",
          [product, main],
        )
      ).rows[0].n,
    ),
    10,
  );
});
test("transfer conserves stock; a late failure rolls the debit back", async () => {
  await h.admin.query(
    `CREATE FUNCTION reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'force failure' AND NEW.delta > 0 THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_credit BEFORE INSERT ON movements FOR EACH ROW EXECUTE FUNCTION reject_credit();`,
  );
  const count = (await h.admin.query("SELECT count(*) FROM movements")).rows;
  assert.equal(
    (
      await api("transfers", {
        productId: product,
        fromWarehouseId: main,
        toWarehouseId: other,
        quantity: 3,
        reason: "force failure",
      })
    ).status,
    500,
  );
  assert.deepEqual(
    (await h.admin.query("SELECT count(*) FROM movements")).rows,
    count,
  );
  assert.equal(
    (
      await api("transfers", {
        productId: product,
        fromWarehouseId: main,
        toWarehouseId: other,
        quantity: 3,
      })
    ).status,
    201,
  );
  assert.equal(
    Number(
      (
        await h.admin.query(
          "SELECT sum(delta) AS n FROM movements WHERE product_id=$1",
          [product],
        )
      ).rows[0].n,
    ),
    10,
  );
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## The concrete case

This lab connects one visible action to the code that accepts or rejects it. Use a disposable dataset and write your prediction before running the operation. The goal is to explain what each boundary contributes, not to memorize a sequence of clicks.

The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

## Write the record before touching the form

Products and warehouses have UUIDs. A movement references one of each and carries signed integer delta, reason and creation time. Stock is SUM(delta) per product/warehouse; there is no separately stored balance to synchronize.

Make a small table in your own notes with these columns: field, starting value, proposed value, and source of truth. Include identity even when the form does not display it. Include related rows or stored counters when the operation changes more than one fact. Mark a value as derived if the app recomputes it rather than storing it independently.

For example, an edit can change a title while preserving an ID. A status command can keep the same status while producing no new history. An import can contain many rows yet be rejected before any replacement begins. In each case, the meaningful observation is the promised resulting state. A success toast alone cannot establish which fields changed.

## Trace the real call path

### Boundary 1 — the React form decides what to send

`client/src/App.tsx`: `submitAdjust` (line 76) turns the form's `kind` and `quantity` into one signed `delta` (`-Math.abs` for an issue, `+Math.abs` for a receipt) and calls `recordMovement`; `submitTransfer` (line 98) sends the `move` state as-is to `transfer`. Both clear `message`, catch errors and show `error.message`, then call `refreshStock()` and `maybeRefreshLedger()`. The sign convention is decided here, in the browser: the server never sees `kind`.

### Boundary 2 — the client serializes the operation as an HTTP request

`client/src/api.ts`: `recordMovement(input)` is `POST /api/movements` with `{ productId, warehouseId, delta, reason }`; `transfer(input)` is `POST /api/transfers` with `{ productId, fromWarehouseId, toWarehouseId, quantity, reason }`. The shared request helper sets the JSON header and throws `Error(data.error)` on non-2xx. The TypeScript types in `shared/types.ts` are erased at runtime, so `delta` can arrive as a string, a float or `null`.

### Boundary 3 — the route parses and validates runtime input

`server/src/index.ts`: `parseMovement` (line 233) requires UUIDs for product and warehouse, a non-zero whole-number `delta` (line 245) and a bounded `reason`; `parseTransfer` (line 255) additionally requires two different warehouses and a positive quantity. Every failure throws `ValidationError`, which the error middleware (line 206) maps to 400; anything else becomes 500 `Something went wrong.` Nothing has touched the database yet when a 400 is produced, which is why the first test can assert an unchanged `count(*)`.

### Boundary 4 — the transaction locks, reads the balance and decides

Inside `withTransaction`, the first statement is always `lockProduct` (line 311): `SELECT id FROM products WHERE id=$1 FOR UPDATE`. A second request for the same product blocks here until the first commits. Only then does `balanceOf` (line 219) sum `movements`, so the balance it reads already includes the other request's insert. `requireWarehouse` checks existence without a lock. The comment above `lockProduct` states the rule that makes opposing transfers deadlock-free: one lock, always the same one, taken before any read.

### Boundary 5 — the storage boundary commits or rolls back

A movement is one `INSERT INTO movements`; a transfer is two inserts (debit then credit) in the same transaction. `withTransaction` (`server/src/db.ts`) wraps them in `BEGIN`/`COMMIT` and issues `ROLLBACK` on any throw. The third test installs a `BEFORE INSERT` trigger that rejects the credit row: the debit insert has already run, the route answers 500, and `count(*)` is unchanged, which proves the rollback. The `CHECK (delta <> 0)` in `server/db/schema.sql` is the database's own last guard.

### Boundary 6 — the response tells the client what actually happened

Both routes answer `201 { ok: true }`; they do not return the new balance. The browser therefore calls `refreshStock()` and re-reads `/api/stock`, which is computed by `SUM(delta)` per product and warehouse. That re-read is what turns the `[201, 400]` outcome of two racing issues into the single correct balance you see on screen.

## Predict the regression scenarios

| Scenario from the executable suite | Prediction to write before running |
|---|---|
| fractional, nonnumeric, unbounded and malformed quantities leave stock unchanged | Initial records, request/input, expected result, and records that must remain unchanged. |
| two simultaneous issues cannot both spend the same stock | Initial records, request/input, expected result, and records that must remain unchanged. |
| transfer conserves stock; a late failure rolls the debit back | Initial records, request/input, expected result, and records that must remain unchanged. |

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

An append-only ledger represents corrections with new entries. Receiving 10 adds +10; issuing 3 adds -3; the balance is 7. A transfer adds -q at the source and +q at the destination, so total stock across warehouses is conserved. Deleting a movement to correct a mistake would erase the explanation of how stock arrived at its current value.

A transaction makes multiple writes all-or-nothing, but a transaction alone does not prevent two readers from approving the same stock. This app locks a product row before computing balances. All movement and transfer writers use that same lock. One product lock serializes its warehouses, trading some concurrency for an understandable rule and avoiding inconsistent lock order between opposite transfers. Direct SQL writers that ignore this protocol are outside the application guarantee.

Number.isInteger checks the quantity rather than truncating it. A request for 1.7 units must not quietly become one unit. The bound matches the SQL integer column. The product lock is taken even for receipts so all writers participate in one ordering. Warehouse existence is checked before inserts; SQL foreign keys still protect stored references.

## Change one requirement independently

**Practice task:** Display a running balance in the ledger.

Before implementation, write three acceptance criteria: an ordinary successful case, a rejected or cancelled case, and a case that preserves existing behavior. Identify the smallest file boundary that owns the rule. Keep the existing regression suite; add a test only when it observes a new promise. Do not reproduce the implementation line by line inside the assertion, because both copies can contain the same mistake.

After a first attempt, compare your design with this hint: Order movements by timestamp and a stable tie-breaker, then accumulate deltas. Explain that the visible 100-row window may require an opening balance.

## Debug a disagreement between layers

If the form and response disagree, inspect the request payload before editing the database code. If the response and database disagree, inspect the mapper, transaction and read query. If a test fails before an HTTP request is logged, inspect startup, environment variables and the test fixture. Missing dependencies, a busy port or an unavailable database are different from a failed business assertion. Preserve the first useful error and fix that cause before interpreting later cascading failures.

When a date looks wrong, distinguish a calendar label from an instant and check the serialization boundary. When an optional field will not clear, distinguish omission from an explicit empty/null value. When a list seems to lose a record, inspect filtering, sorting and pagination before assuming deletion. When history duplicates, compare desired-state commands with commands that represent a new event. These are diagnostic questions to apply to the actual fields above.

## Final independent checkpoint

Close this guide and give a five-minute walkthrough using only the application source and one test. Explain the user-visible problem, the input contract, the identity model, the write boundary, a failed operation and the remaining limitation. Then modify the worked fixture and predict the result without running it. Reopen the guide only after writing your answer.

A useful review note includes the exact command run, its result, and the boundary it covers. Keep browser interaction, simulated storage tests, real HTTP/database tests and compile checks distinct. The [verification page](VERIFICATION.md) records this delivery’s evidence. Exercises and proposed extensions in this course remain learner work; they are not counted as implemented features.
