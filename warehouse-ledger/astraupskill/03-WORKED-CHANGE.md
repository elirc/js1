# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Fractional quantities were truncated, and two transactions could both read enough stock before either wrote its debit.

**After:** Movement and transfer payloads require valid UUIDs, bounded whole quantities and text reasons. Every write locks the product before reading balances. Transfers remain two atomic ledger entries.

## Predict this example

The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones Astra changed (compare `AstraOrganized2/astrafinalplan/implementation/batch04/backups/55/server/src/index.ts` with `diff --strip-trailing-cr -w`): the movement route now runs inside `withTransaction`, takes `lockProduct` before reading `balanceOf`, and rejects an over-issue with a 400 whose message carries the real balance; the transfer route reuses the same lock and inserts both rows in one transaction. The linked source is authoritative if you later edit the project.

```typescript
app.post(
  "/api/movements",
  asyncRoute(async (req, res, next) => {
    try {
      const input = parseMovement(req.body);
      await withTransaction(async (client) => {
        await lockProduct(client, input.productId);
        await requireWarehouse(client, input.warehouseId);
        if (input.delta < 0) {
          const balance = await balanceOf(
            client,
            input.productId,
            input.warehouseId,
          );
          if (balance + input.delta < 0) {
            throw new ValidationError(
              `Only ${balance} on hand — cannot issue ${-input.delta}.`,
            );
          }
        }
        await client.query(
          "INSERT INTO movements (product_id, warehouse_id, delta, reason) VALUES ($1, $2, $3, $4)",
          [input.productId, input.warehouseId, input.delta, input.reason],
        );
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }),
);


// server/src/index.ts:311
// Every write takes the same product lock before reading balances. This also
// serializes opposing transfers without taking warehouse locks in different orders.
async function lockProduct(client: PoolClient, id: string) {
  const result = await client.query(
    "SELECT id FROM products WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!result.rowCount) throw new ValidationError("Product not found.");
}
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

An append-only ledger represents corrections with new entries. Receiving 10 adds +10; issuing 3 adds -3; the balance is 7. A transfer adds -q at the source and +q at the destination, so total stock across warehouses is conserved. Deleting a movement to correct a mistake would erase the explanation of how stock arrived at its current value.

A transaction makes multiple writes all-or-nothing, but a transaction alone does not prevent two readers from approving the same stock. This app locks a product row before computing balances. All movement and transfer writers use that same lock. One product lock serializes its warehouses, trading some concurrency for an understandable rule and avoiding inconsistent lock order between opposite transfers. Direct SQL writers that ignore this protocol are outside the application guarantee.

Number.isInteger checks the quantity rather than truncating it. A request for 1.7 units must not quietly become one unit. The bound matches the SQL integer column. The product lock is taken even for receipts so all writers participate in one ordering. Warehouse existence is checked before inserts; SQL foreign keys still protect stored references.

## Three variations to work through

**Normal variation — a receipt then an issue.** `POST /api/movements` with `delta: 5` for the seeded product in `main`, then `delta: -3`. Predict the two `SUM(delta)` values you will read from `psql` between the calls and after; then check `/api/stock` shows the same number. Reason: no balance check runs for a positive delta.

**Invalid variation — a fractional issue.** `POST /api/movements` with `delta: -2.5`. Predict: 400 `Quantity must be a non-zero whole number.` and `SELECT count(*) FROM movements` unchanged. Then send `delta: "-2"` (a string): predict whether `parseMovement` coerces or rejects, run it, and read the parser to explain the outcome.

**Boundary variation — the race.** Reproduce the second test by hand: with 40 on hand, fire two `delta: -30` requests with `Promise.all`. Predict `[201, 400]` in some order and a final balance of 10. Then remove the `lockProduct` call on a throwaway branch and repeat until you observe `[201, 201]` and a balance of -20; put the lock back. Explain which statement the second request was waiting on, and why reading the balance before the lock would be wrong.

## Executable examples

These are the actual regression tests in [test/ledger.test.ts](../test/ledger.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
