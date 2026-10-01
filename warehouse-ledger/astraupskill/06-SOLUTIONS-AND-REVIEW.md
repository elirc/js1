# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Movement and transfer payloads require valid UUIDs, bounded whole quantities and text reasons. Every write locks the product before reading balances. Transfers remain two atomic ledger entries.

The key model is: Products and warehouses have UUIDs. A movement references one of each and carries signed integer delta, reason and creation time. Stock is SUM(delta) per product/warehouse; there is no separately stored balance to synchronize.

The worked fixture should behave as follows: The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

## Extension solutions

### Exercise 1

**Prompt:** Display a running balance in the ledger.

**Approach:** Order movements by timestamp and a stable tie-breaker, then accumulate deltas. Explain that the visible 100-row window may require an opening balance.

**Review:** the running balance must be accumulated in the same order the ledger is displayed (timestamp, then a stable tie-breaker such as `id`), and your test must include two movements with equal `created_at`; if the ledger shows only the latest 100 rows, show where the opening balance comes from and prove it equals `SUM(delta)` of the hidden rows.

### Exercise 2

**Prompt:** Add a reversal command referencing the original movement.

**Approach:** Create an opposite signed movement in a transaction and store the original ID. Prevent a repeated reversal from duplicating the effect.

**Review:** a reversal must be one opposite-signed movement inserted in a transaction that first takes `lockProduct`; store the original movement id in a new column; a second reversal of the same movement must be rejected (unique index on that column or an explicit check under the lock) and your test must show the balance moved exactly once after two reversal requests.

### Exercise 3

**Prompt:** Reject a transfer when one warehouse is missing and show recovery feedback.

**Approach:** Assert no new rows on failure, retain the form and explain which reference is missing.

**Review:** the missing-warehouse case must return 400 from `requireWarehouse` inside the transaction with `count(*)` unchanged (reuse the first test's comparison), the form must keep its values, and the message must name which warehouse reference failed; explain why this check runs after `lockProduct` and what would change if it ran before.

### Exercise 4

**Prompt:** Compare per-product locking with per-product/warehouse locking.

**Approach:** Finer locks improve concurrency but transfers require both locks in a deterministic order. Include opposing transfers in a deadlock test before adopting that design.

**Review:** your comparison must include the deadlock experiment: replace `lockProduct` with two warehouse row locks taken in payload order, run two opposite transfers concurrently with `Promise.all`, and report the PostgreSQL error code you observe (`40P01`); then fix it by sorting the two warehouse ids before locking and show the same pair now yields `[201, 201]` with conserved stock.

### Exercise 7 — feel the lock ordering rule

Reference for the deadlocking variant and its repair:

```typescript
async function lockWarehouse(client: PoolClient, id: string) {
  const r = await client.query("SELECT id FROM warehouses WHERE id=$1 FOR UPDATE", [id]);
  if (!r.rowCount) throw new ValidationError("Warehouse not found.");
}
// deadlocking: payload order
await lockWarehouse(client, input.fromWarehouseId);
await lockWarehouse(client, input.toWarehouseId);
// repaired: deterministic order
for (const id of [input.fromWarehouseId, input.toWarehouseId].sort()) await lockWarehouse(client, id);
```

Reference test skeleton:

```typescript
test("opposite transfers under warehouse locks", async () => {
  const [a, b] = await Promise.all([
    api("transfers", { productId: product, fromWarehouseId: main, toWarehouseId: other, quantity: 1 }),
    api("transfers", { productId: product, fromWarehouseId: other, toWarehouseId: main, quantity: 1 }),
  ]);
  console.log(a.status, b.status); // payload order: sometimes [201, 500]; sorted order: always [201, 201]
  const sum = await h.admin.query("SELECT sum(delta) AS n FROM movements WHERE product_id=$1", [product]);
  assert.equal(Number(sum.rows[0].n), 40); // conserved either way: the loser rolled back
});
```

Review: the interesting observation is that stock is conserved even in the deadlock case (the aborted transaction rolled back), so the bug is availability, not integrity. Say which log line or error code proved the deadlock, and why sorting ids is a complete fix for two locks but not obviously for N locks across different tables.

### Exercise 8 — ownership and authorization

Reference (the check lives after the lock, inside the transaction, so a concurrent operator change cannot slip through):

```typescript
if (input.delta < 0) {
  const ok = await client.query("SELECT 1 FROM warehouse_operators WHERE warehouse_id=$1 AND actor=$2", [input.warehouseId, actor]);
  if (!ok.rowCount) throw new ForbiddenError("You do not operate this warehouse.");
}
```

Review: explain why this is authorization and not validation (the request is well-formed; the caller is simply not allowed), why the ledger should record the actor from the header rather than from the body, and what the `count(*)` assertion proves that a 403 status alone does not.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/ledger.test.ts](../test/ledger.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Fractional quantities were truncated, and two transactions could both read enough stock before either wrote its debit. I changed the implementation so that: Movement and transfer payloads require valid UUIDs, bounded whole quantities and text reasons. Every write locks the product before reading balances. Transfers remain two atomic ledger entries. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
