# Trace lab: filter-sort-slice order and numeric boundaries

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Three same-price products at two per page give stable ids on page 1. Page 999 becomes page 2 with one item. Infinite/fractional page inputs use defaults; infinite prices and fractional stock are rejected.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form and the list controls decide what to send

`client/src/App.jsx`: four controlled inputs for the product form; search, category, sort direction and page controls change query-string state.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `GET /api/products?search=&category=&sort=&dir=&page=&pageSize=`; `POST`/`PUT /api/products`.

### Boundary 3 — the list route normalizes paging, the middleware validates products

`server/server.js:22` reads and normalizes `page`/`pageSize` with `whole()`; `validateProduct` (line 62) is the single gate for name, category, finite non-negative price and whole stock.

### Boundary 4 — the repository filters, sorts and slices

`repository.query()` (line 105): filter by category and name, stable sort with `compare(...) || a.id.localeCompare(b.id)`, compute `total` and `totalPages`, clamp `page`, then slice one page.

### Boundary 5 — the storage boundary is process memory

`products` is a module-level array; restart reseeds; synchronous, no interleaving.

### Boundary 6 — the response tells the client what happened

`{ items, total, page, pageSize }` for lists; 201/200/400 for writes; the client re-fetches the current page after a write.

## Expected observations

| Action or input | Expected result |
|---|---|
| 5 matches, pageSize 2 | 3 pages |
| Request page 999 | Clamped last page, one item |
| No matching products | Usable first page with total zero |
| Fractional stock | Rejected |
| Equal primary sort values | Deterministic id tie-breaker |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Filter, then sort, then slice. Slicing first produces sparse pages and misleading totals. Equal prices still need a unique tie-breaker to make boundaries deterministic.

Requested and returned pages can differ after deletion. The server knows the filtered total and clamps to its last real page; the client should display that metadata. Infinity is not a valid price just because it is >= 0. Checking finite values, whole stock counts and accepted text representations prevents conversions from hiding malformed input. Pagination does not add persistence or concurrency guarantees to an in-memory store.

Pause near `createProductRepository` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- equal sort values have stable page boundaries and invalid page numbers normalize
- bad numeric/text values cannot replace a valid product

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
