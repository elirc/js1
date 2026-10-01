# Trace lab: count/page consistency, stable ordering and bounded input

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
test("search plus tag filtering retains totals when requesting a page beyond the end", async () => {
  const user = (await call("/api/users")).data[0];
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await call("/api/threads", "POST", {
          title: "Astraforum paging",
          body: "Astraforum explains stable SQL pagination.",
          authorId: user.id,
          tagNames: [" Lesson ", "lesson"],
        })
      ).status,
      201,
    );
  const query = "/api/threads?q=Astraforum&tag=lesson&pageSize=2";
  const first = (await call(query)).data,
    again = (await call(query)).data;
  assert.equal(first.total, 3);
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  const last = (await call(query + "&page=999")).data;
  assert.equal(last.total, 3);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const empty = (await call("/api/threads?q=absentfixture&page=999")).data;
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
});
test("malformed nested tags and author references do not create partial threads", async () => {
  const user = (await call("/api/users")).data[0],
    input = {
      title: "Validation lesson",
      body: "Some text",
      authorId: user.id,
      tagNames: ["lesson"],
    };
  const count = Number(
    (await h.admin.query("SELECT COUNT(*) AS n FROM threads")).rows[0].n,
  );
  for (const bad of [
    { tagNames: [{}] },
    { tagNames: [""] },
    { authorId: "bad" },
    { authorId: randomUUID() },
    { title: 4 },
  ])
    assert.equal(
      (await call("/api/threads", "POST", { ...input, ...bad })).status,
      400,
    );
  assert.equal(
    Number(
      (await h.admin.query("SELECT COUNT(*) AS n FROM threads")).rows[0].n,
    ),
    count,
  );
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/feature.test.ts](../test/feature.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create three threads that match a unique search term and a shared tag, request the list with pageSize 2, and repeat the request: both responses report total 3 and the same ids in the same order. Request page 999 of that query: the response clamps to page 2 with one item and total 3. A search with no matches clamps to page 1 with total 0. Malformed tag or author data is rejected with 400 and the thread count is unchanged.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the search form decides what to send

`client/src/App.tsx`: the search box, tag select and page controls build the query; the new-thread form sends `title`, `body`, `authorId`, `tagNames`.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `GET /api/threads?q=&tag=&page=&pageSize=`, `POST /api/threads`, `DELETE /api/threads/:id`.

### Boundary 3 — the route bounds the input

`server/src/index.ts:34`: `pageNumber` (line 192) clamps page and size; `parseThread` (line 172) validates title, body, author id and tag names; `validId` rejects malformed ids.

### Boundary 4 — the transaction takes one snapshot

`withTransaction` + `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` (line 40): `COUNT(*)` with the same `WHERE`, compute `totalPages`, clamp `page`, then the page `SELECT` with `ORDER BY created_at DESC, id DESC LIMIT/OFFSET`.

### Boundary 5 — PostgreSQL answers from the snapshot

both statements read the same snapshot, so `total` and `items` agree; concurrent inserts are invisible until the next request (chapter 2).

### Boundary 6 — the response tells the client what happened

`{ items, total, page, pageSize }`; the client renders and, for creates, re-fetches page 1.

## Expected observations

| Action or input | Expected result |
|---|---|
| 3 matches, pageSize 2 | total 3; page 1 has two items |
| Same query twice | Identical ids in identical order (stable tie-break on id) |
| Request page 999 | Clamped to page 2 with one item, total 3 |
| Query with no matches, page 999 | Clamped to page 1, total 0, empty items |
| Count and rows | One request snapshot |
| Slow-old search response | Separate client race remains an exercise |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Suppose six matching threads use a five-row page. Page two has one item. Deleting it leaves five matches, so page two no longer exists. Clamp the requested page after counting, then calculate offset from the clamped value. With zero matches, retain a usable first-page representation rather than negative offsets. Stable sorting adds a unique id after the primary sort key so tied values have a deterministic order.

A REPEATABLE READ transaction makes the count and row query see the same snapshot within one request. It does not freeze results across later page requests: another user can insert or delete between clicks. The browser also has a separate responsibility when multiple searches race. This change does not add a stale-response guard; a request sequence counter or AbortController is a useful independent extension. Database consistency and latest-user-intent rendering address different boundaries.

Pause near `REPEATABLE READ` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- search plus tag filtering retains totals when requesting a page beyond the end
- malformed nested tags and author references do not create partial threads

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
