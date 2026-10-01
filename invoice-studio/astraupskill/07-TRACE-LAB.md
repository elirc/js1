# Trace lab: decimal input contracts and transactional parent/child writes

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/feature.test.ts](../test/feature.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create two units at 12.34, zero tax, issued 2028-02-29: total 24.68. Reject quantity [2], a three-decimal price and 2027-02-29. Force a replacement line insert to fail and verify the old invoice and lines remain intact.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the invoice form decides what to send

`client/src/App.tsx`: client select, issue date, tax rate and a line-item table; the form sends `{ clientId, status, issuedDate, taxRate, items[] }`.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `POST /api/invoices`, `PUT /api/invoices/:id` (replaces lines), `PATCH /api/invoices/:id/status`.

### Boundary 3 — `parseInvoice` validates shape, then value

`server/src/index.ts:230`: client id, calendar-safe issue date, `decimal` tax rate, then each line: text, quantity shape then value, price with two decimals; 1-100 lines.

### Boundary 4 — the transaction writes the invoice and its lines

`POST` (line 106) inserts the invoice and its lines in `withTransaction`; `PUT` (line 132) updates the header, deletes and re-inserts lines, recomputes rounded totals, all on one client.

### Boundary 5 — PostgreSQL keeps exact cents

`numeric(12,2)` columns; the third test rejects the line insert with a trigger and shows the original invoice and lines intact after the rollback.

### Boundary 6 — the response tells the client what happened

`loadInvoice` (line 193) re-reads header and lines; totals come back as numbers rounded to cents; 400 with the specific `parseInvoice` message otherwise.

## Expected observations

| Action or input | Expected result |
|---|---|
| 2 x 12.34, tax 0 | 24.68 |
| Quantity [2] | Rejected shape despite JavaScript coercion |
| Price 12.345 | Rejected precision |
| Issue date 2027-02-29 | Rejected calendar date |
| Late replacement line failure | Original invoice and lines remain |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

An input contract must distinguish numbers, numeric strings, empty strings, arrays and objects. JavaScript coercion can turn [] into zero and [2] into two; neither is an acceptable quantity payload. Validate primitive shape and decimal precision before arithmetic. Quantity is a positive whole number, whereas unit price allows at most two decimal places. A date input represents a calendar label, so 2028-02-29 is valid and 2027-02-29 is not.

For two units at 12.34 and zero tax, the total is 24.68. The implementation rounds the aggregate to two decimal places; it is a teaching calculation, not a complete accounting policy for every currency or tax regime. Parent and child writes use one transaction. Updating the parent and deleting old lines before a failed replacement line must roll back all three steps. The failure test injects a database trigger in a disposable schema so it exercises a late database failure instead of stopping at input validation.

Pause near `parseInvoice` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- invoice totals use validated line inputs and preserve calendar dates
- invalid dates, whole quantities and nested values are rejected before replacing lines
- a database failure after line deletion restores the original invoice and lines

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
