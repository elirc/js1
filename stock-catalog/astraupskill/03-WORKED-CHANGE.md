# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Fractional/infinite paging values were insufficiently normalized, sort ties lacked a unique tie-breaker and malformed prices reached unsafe paths.

**After:** Paging normalizes to bounded whole values. Sort ties use ids. Names/categories are bounded text, prices are finite and bounded, and stock is a nonnegative whole count. Existing last-page clamping has regression coverage.

## Predict this example

Three same-price products at two per page give stable ids on page 1. Page 999 becomes page 2 with one item. Infinite/fractional page inputs use defaults; infinite prices and fractional stock are rejected.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones Astra changed (compare `AstraOrganized2/astrafinalplan/implementation/batch03/backups/26/server/server.js` with `diff --strip-trailing-cr -w`): the `whole()` normalization of `page` and `pageSize` (a malformed page becomes 1, a page size outside 1..1000000 becomes 5, a valid one is capped at 50) and the `id` tie-break in the sort that makes page boundaries stable. The linked source is authoritative if you later edit the project.

```javascript
// server/server.js:27 (before: page = Number(req.query.page) || 1; pageSize = Number(req.query.pageSize) || 5)
  const page = whole(req.query.page,1,1000000) ? Number(req.query.page) : 1;
  const pageSize = whole(req.query.pageSize,1,1000000) ? Math.min(Number(req.query.pageSize),50) : 5;

// server/server.js:99 (before: no tie-break, so equal prices could swap between pages)

      const sorted = [...filtered].sort((a, b) => compare(a, b, sort, dir) || a.id.localeCompare(b.id));

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Filter, then sort, then slice. Slicing first produces sparse pages and misleading totals. Equal prices still need a unique tie-breaker to make boundaries deterministic.

Requested and returned pages can differ after deletion. The server knows the filtered total and clamps to its last real page; the client should display that metadata. Infinity is not a valid price just because it is >= 0. Checking finite values, whole stock counts and accepted text representations prevents conversions from hiding malformed input. Pagination does not add persistence or concurrency guarantees to an in-memory store.

## Three variations to work through

- **Normal variation — a clamped page.** With three matching products and `pageSize=2`, request `page=999`. Predict `page: 2` with one item and `total: 3`; then `page=Infinity&pageSize=2.5`: predict `page: 1, pageSize: 5`.

- **Invalid variation — a negative price.** `POST` with `price: -1`. Predict 400 from the single gate and no product. Then `price: "12.50"` (string): predict 201 (`Number` accepts it).

- **Boundary variation — equal prices across a page boundary.** Create three products with the same price, `pageSize=2`, fetch pages 1 and 2 twice each. Predict the same ids on each page every time (the `id` tie-break); then remove the tie-break on a throwaway branch and reason about whether pages could overlap after an insert.

## Executable examples

These are the actual regression tests in [test/api.test.js](../test/api.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
