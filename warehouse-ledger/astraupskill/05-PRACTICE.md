# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Display a running balance in the ledger.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a reversal command referencing the original movement.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Reject a transfer when one warehouse is missing and show recovery feedback.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Compare per-product locking with per-product/warehouse locking.

Write a short design note before coding. List the current guarantee, the stronger guarantee you want and the new failure modes the change introduces. If this requires a larger architectural change, stop at a concrete proposal and test design until you understand the prerequisite. The earlier exercises should remain understandable and runnable.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/src/index.ts](../server/src/index.ts) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Exercise 7 — feel the lock ordering rule

The comment above `lockProduct` in `server/src/index.ts` says one product lock serializes opposing transfers without taking warehouse locks in different orders. Make that rule bite before you trust it.

1. Predict: if `lockProduct` were replaced by locking the two warehouse rows in payload order (`FOR UPDATE` on `fromWarehouseId`, then on `toWarehouseId`), what happens when transfer A moves 1 unit main -> other while transfer B moves 1 unit other -> main at the same time? Write the interleaving down with four lines (A locks main, B locks other, A waits for other, B waits for main).
2. On a throwaway branch, implement that variant (`lockWarehouse(client, id)` called twice, no product lock). Add a test that runs the two opposite transfers in a `Promise.all` and records both statuses and, for the failure, `error.code`.
3. Run it several times. You should see at least one run where PostgreSQL aborts one transaction with `40P01 deadlock_detected` after `deadlock_timeout` (1 s by default), and the route answers 500.
4. Fix it without going back to the product lock: lock the warehouse ids in sorted order. Re-run: `[201, 201]` every time and `SUM(delta)` per warehouse is conserved.
5. Return to the shipped `lockProduct` design and explain, in three sentences, what each design buys and costs (throughput for unrelated warehouses of the same product versus simplicity).

## Exercise 8 — ownership and authorization

Movements have no actor. Add one and scope who may issue stock from which warehouse.

1. Read `X-Actor` in a small middleware; blank on `POST` -> 401. Add a `warehouse_operators(warehouse_id, actor)` table to `server/db/schema.sql` with two seed rows.
2. Inside the transaction of `POST /api/movements`, after `lockProduct`, check that `(input.warehouseId, req.actor)` exists in `warehouse_operators` for any negative `delta`; otherwise throw a `ForbiddenError` mapped to 403. Receipts (positive delta) stay open. For transfers, require the actor on the source warehouse only.
3. Record `actor` on the inserted movement row (new column) so the ledger shows who moved stock.

Acceptance: an issue by a non-operator is 403 and `count(*)` is unchanged; the same issue by an operator is 201; a receipt by anyone is 201; a transfer whose actor operates only the destination is 403.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
