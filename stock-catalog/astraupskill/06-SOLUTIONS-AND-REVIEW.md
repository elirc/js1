# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

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
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
const valid = {
  name: "Astraproduct tie",
  category: "Learning",
  price: 12.5,
  stock: 2,
};
test("equal sort values have stable page boundaries and invalid page numbers normalize", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal((await call("/api/products", "POST", valid)).status, 201);
  const query = "/api/products?search=Astraproduct&sort=price&pageSize=2";
  const first = (await call(query)).data,
    again = (await call(query)).data;
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  assert.equal(first.total, 3);
  const last = (await call(query + "&page=999")).data;
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const malformed = (await call("/api/products?page=Infinity&pageSize=2.5"))
    .data;
  assert.equal(malformed.page, 1);
  assert.equal(malformed.pageSize, 5);
});
test("bad numeric/text values cannot replace a valid product", async () => {
  const made = await call("/api/products", "POST", valid);
  for (const bad of [
    { price: "Infinity" },
    { price: "" },
    { price: true },
    { stock: 1.5 },
    { name: {} },
    { stock: null },
  ])
    assert.equal(
      (await call("/api/products/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
    );
});

test("page size is clamped when valid and defaulted when malformed", async () => {
  assert.equal((await call("/api/products?pageSize=500")).data.pageSize, 50);
  assert.equal((await call("/api/products?pageSize=0")).data.pageSize, 5);
  assert.equal((await call("/api/products?pageSize=2.5")).data.pageSize, 5);
  assert.equal((await call("/api/products?pageSize=7")).data.pageSize, 7);
});
```

## Existing implementation

Paging normalizes to bounded whole values. Sort ties use ids. Names/categories are bounded text, prices are finite and bounded, and stock is a nonnegative whole count. Existing last-page clamping has regression coverage.

The key model is: Products have id, name, category, price and stock. The API returns items and page metadata. The client holds one page; the repository itself remains in memory.

The worked fixture should behave as follows: Three same-price products at two per page give stable ids on page 1. Page 999 becomes page 2 with one item. Infinite/fractional page inputs use defaults; infinite prices and fractional stock are rejected.

## Extension solutions

### Exercise 1

**Prompt:** Add filtered inventory value across all pages.

**Approach:** Aggregate before slicing; visible-page value is a different metric.

**Review:** `inventoryValue` must be computed on the filtered set before the slice (the same place `total` is computed) and the test must assert it is equal on every page and changes with the filter.

### Exercise 2

**Prompt:** Add a secondary sort choice.

**Approach:** Whitelist both keys and retain id as the final tie-breaker.

**Review:** the comparator must chain primary, secondary and `id`; the test must include equal primaries with different secondaries and equal secondaries with different ids, fetched twice.

### Exercise 3

**Prompt:** Translate paging into SQL.

**Approach:** Bind filters and whitelist ORDER BY identifiers; keep count and rows consistent.

**Review:** the SQL version must keep the paging test green unchanged, use bound parameters for every user value, and add an index that the query plan uses; explain why `OFFSET` gets slow and what a keyset alternative looks like.

### Exercise 4

**Prompt:** Delete the final row of the final page.

**Approach:** Refetch and verify clamping with the correct total rather than showing an empty phantom page.

**Review:** the test must delete the only row on the last page and assert the clamped page, the ids on it and `total`; explain where the clamp lives (`Math.min(page, totalPages)` in `query()`).

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `owner` stamped on `POST`, and an owner comparison before the array mutation in `PUT`/`DELETE`. Extend `request()` in `test/http.js` with a headers argument.

Review: the list is public, so 403 (not 404) is right for a foreign edit; explain the difference from the job-pipeline course, where the list is private.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Fractional/infinite paging values were insufficiently normalized, sort ties lacked a unique tie-breaker and malformed prices reached unsafe paths. I changed the implementation so that: Paging normalizes to bounded whole values. Sort ties use ids. Names/categories are bounded text, prices are finite and bounded, and stock is a nonnegative whole count. Existing last-page clamping has regression coverage. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
