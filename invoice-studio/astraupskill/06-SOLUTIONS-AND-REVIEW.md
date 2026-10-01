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

## Existing implementation

Invoices validate client UUIDs, real issue dates, bounded line arrays, whole positive quantities, two-decimal prices and tax from 0 to 100. Parent and line writes commit together, and a late line failure leaves no partial invoice change.

The key model is: An invoice is a parent row referencing a client. Line rows reference that invoice and contain description, quantity and unit price. Totals derive from the submitted lines and tax rate. The current UI creates invoices; API update behavior is exercised separately by regression tests.

The worked fixture should behave as follows: Create two units at 12.34, zero tax, issued 2028-02-29: total 24.68. Reject quantity [2], a three-decimal price and 2027-02-29. Force a replacement line insert to fail and verify the old invoice and lines remain intact.

## Extension solutions

### Exercise 1

**Prompt:** Show the calculated total before submit.

**Approach:** Share a clearly specified calculation contract and show a preview; the server remains authoritative and must validate independently.

**Review:** the preview must use the exact server rule (sum lines, apply tax, round once) and the test must compare the preview with the stored `total` for the `0.1 x 2 at 10%` case; no request while typing.

### Exercise 2

**Prompt:** Add an invoice edit form.

**Approach:** Load the parent and complete line set, preserve their intended replacement semantics, and show failed-save feedback without discarding the draft.

**Review:** the edit must send the complete line set (the `PUT` replaces lines inside one transaction), a rejected save must keep the draft, and the success path must render the re-read invoice, not the request body.

### Exercise 3

**Prompt:** Test the maximum accepted quantity and price boundaries.

**Approach:** Use bounded fixtures and assert both immediately accepted and immediately rejected values; distinguish business maxima from database numeric limits.

**Review:** the boundary test must assert both sides of each bound and name the check that rejects an overflowing total before it reaches `numeric(12,2)`.

### Exercise 4

**Prompt:** Design an integer-minor-unit monetary model.

**Approach:** Define currency scale, rounding stage and overflow bounds before converting. Explain how tax fractional cents are rounded; do not merely multiply arbitrary floats by 100.

**Review:** the cents design must fix the currency scale, name the single rounding stage for tax, bound the integer range, and keep the wire format as decimal strings; the test must show the cents arithmetic for `12.34 x 3 at 7.5%`.

### Exercise 7 — ownership and authorization

Reference: an actor middleware; `issued_by` column; in the `PUT` transaction `SELECT issued_by FROM invoices WHERE id = $1 FOR UPDATE` and throw a `ForbiddenError` (403) on mismatch so the rollback releases the lock before any line is deleted.

Review: the check must precede the `DELETE FROM invoice_lines`; explain what a client would observe if it came after.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/feature.test.ts](../test/feature.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Malformed line values could reach arithmetic or database operations, including fractional quantities, impossible calendar dates and unsupported decimal precision. I changed the implementation so that: Invoices validate client UUIDs, real issue dates, bounded line arrays, whole positive quantities, two-decimal prices and tax from 0 to 100. Parent and line writes commit together, and a late line failure leaves no partial invoice change. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
