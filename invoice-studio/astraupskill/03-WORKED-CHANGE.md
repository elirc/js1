# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Malformed line values could reach arithmetic or database operations, including fractional quantities, impossible calendar dates and unsupported decimal precision.

**After:** Invoices validate client UUIDs, real issue dates, bounded line arrays, whole positive quantities, two-decimal prices and tax from 0 to 100. Parent and line writes commit together, and a late line failure leaves no partial invoice change.

## Predict this example

Create two units at 12.34, zero tax, issued 2028-02-29: total 24.68. Reject quantity [2], a three-decimal price and 2027-02-29. Force a replacement line insert to fail and verify the old invoice and lines remain intact.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 108. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
    const input = parseInvoice(req.body);
    // The invoice header and its items must be inserted together or not at all.
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO invoices (client_id, status, issued_date, tax_rate)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.clientId, input.status, input.issuedDate, input.taxRate]
      );
      const invoiceId = rows[0]!.id;
      for (const item of input.items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [invoiceId, item.description, item.quantity, item.unitPrice]
        );
      }
      return invoiceId;
    });
    res.status(201).json(await loadInvoice(id));
  } catch (error) {
    next(error);
  }
}));

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

An input contract must distinguish numbers, numeric strings, empty strings, arrays and objects. JavaScript coercion can turn [] into zero and [2] into two; neither is an acceptable quantity payload. Validate primitive shape and decimal precision before arithmetic. Quantity is a positive whole number, whereas unit price allows at most two decimal places. A date input represents a calendar label, so 2028-02-29 is valid and 2027-02-29 is not.

For two units at 12.34 and zero tax, the total is 24.68. The implementation rounds the aggregate to two decimal places; it is a teaching calculation, not a complete accounting policy for every currency or tax regime. Parent and child writes use one transaction. Updating the parent and deleting old lines before a failed replacement line must roll back all three steps. The failure test injects a database trigger in a disposable schema so it exercises a late database failure instead of stopping at input validation.

## Three variations to work through

- **Normal variation — the fixture in cents.** `12.34 x 2` at `0%`: predict `subtotal 24.68`, `tax 0`, `total 24.68` (fourth test). Then `0.1 x 2` at `10%`: predict `0.22`, and say where the rounding happened.

- **Invalid variation — three decimals.** `unitPrice: 0.001`: predict 400 `Use whole quantities and prices with at most two decimal places.` and no invoice (second test). `issuedDate: "2027-02-29"`: predict 400 from the date round-trip.

- **Boundary variation — a failed line insert.** Reuse the third test's trigger against your dev database and `PUT` new lines: predict 500, and the old header and lines unchanged.

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
async function fixture() {
  const client = (await call("/api/clients")).data[0];
  return {
    clientId: client.id,
    status: "draft",
    issuedDate: "2028-02-29",
    taxRate: 10,
    items: [{ description: "Lesson", quantity: 2, unitPrice: 0.1 }],
  };
}
test("invoice totals use validated line inputs and preserve calendar dates", async () => {
  const made = await call("/api/invoices", "POST", await fixture());
  assert.equal(made.status, 201);
  assert.equal(made.data.issuedDate, "2028-02-29");
  assert.equal(made.data.subtotal, 0.2);
  assert.equal(made.data.tax, 0.02);
  assert.equal(made.data.total, 0.22);
});
test("invalid dates, whole quantities and nested values are rejected before replacing lines", async () => {
  const input = await fixture(),
    made = await call("/api/invoices", "POST", input),
    path = "/api/invoices/" + made.data.id;
  for (const bad of [
    { issuedDate: "2027-02-29" },
    { taxRate: "Infinity" },
    { taxRate: 101 },
    { items: [null] },
    { items: [{ description: "bad", quantity: 1.5, unitPrice: 2 }] },
    { items: [{ description: "bad", quantity: [1], unitPrice: 2 }] },
    { items: [{ description: "bad", quantity: 1, unitPrice: 0.001 }] },
  ])
    assert.equal(
      (await call(path, "PUT", { ...input, ...bad })).status,
      400,
      JSON.stringify(bad),
    );
  assert.deepEqual((await call(path)).data, made.data);
});
test("a database failure after line deletion restores the original invoice and lines", async () => {
  const input = await fixture(),
    made = await call("/api/invoices", "POST", input),
    path = "/api/invoices/" + made.data.id;
  await h.admin.query(
    "CREATE FUNCTION reject_invoice_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description='Fail after delete' THEN RAISE EXCEPTION 'injected line failure'; END IF; RETURN NEW; END $$",
  );
  await h.admin.query(
    "CREATE TRIGGER reject_invoice_line BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION reject_invoice_line()",
  );
  try {
    assert.equal(
      (
        await call(path, "PUT", {
          ...input,
          items: [
            { description: "Fail after delete", quantity: 1, unitPrice: 2 },
          ],
        })
      ).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
  } finally {
    await h.admin.query("DROP TRIGGER reject_invoice_line ON invoice_items");
  }
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
