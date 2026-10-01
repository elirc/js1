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

## Existing implementation

Search count and rows share a read-only repeatable-read transaction. Page numbers clamp to the available range, ordering has an id tie-breaker, and thread/tag inputs and author references are validated.

The key model is: Threads belong to authors and can carry tags. A filtered result consists of items, total, page and page count; these values describe one database snapshot for that request. They are not independent facts to calculate with unrelated filters.

The worked fixture should behave as follows: Create three threads that match a unique search term and a shared tag, request the list with pageSize 2, and repeat the request: both responses report total 3 and the same ids in the same order. Request page 999 of that query: the response clamps to page 2 with one item and total 3. A search with no matches clamps to page 1 with total 0. Malformed tag or author data is rejected with 400 and the thread count is unchanged.

## Extension solutions

### Exercise 1

**Prompt:** Add a latest-request-wins guard in the React search flow.

**Approach:** Capture an increasing sequence id per request and apply results only if it is still current; test slow-old versus fast-new completion.

**Review:** the guard must compare a per-request sequence in the response handler; the test must resolve the older promise last and assert the newer list; no server change.

### Exercise 2

**Prompt:** Keep filters in the URL.

**Approach:** Parse and validate URL parameters, initialize controls and reset page when filters change. Avoid a state/URL update loop.

**Review:** the URL must be the source of truth on load, the page must reset on filter change, and there must be no state->URL->state loop (assert one navigation per change).

### Exercise 3

**Prompt:** Test equal timestamps across page boundaries.

**Approach:** Create tied timestamps and assert the unique secondary ordering across repeated requests on unchanged data.

**Review:** the tie-break test must create equal timestamps inside one transaction and read a page boundary twice; explain why `ORDER BY created_at DESC, id DESC` is required even though PostgreSQL often returns the same order anyway.

### Exercise 4

**Prompt:** Design cursor pagination for a large changing forum.

**Approach:** Use a cursor containing the primary sort value and unique id; explain how inserts and deletes affect traversal, and retain a deterministic ordering contract.

**Review:** the cursor must encode the sort key and the id, the note must cover an insert before the cursor and a delete of the cursor row, and the test must prove no duplicates or gaps across three pages with a concurrent insert.

### Exercise 7 — ownership and authorization

Reference: an actor middleware; in `POST` ignore `body.authorId` and use `req.actor`; in `DELETE`, `DELETE FROM threads WHERE id = $1 AND author_id = $2` and answer 403 when `rowCount` is 0 but the thread exists (or 404 if you prefer not to reveal it; say which and why).

Review: the ownership predicate is inside the `DELETE` statement, so there is no read-then-write window.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/feature.test.ts](../test/feature.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Counting and fetching rows in separate snapshots could disagree, and an out-of-range page could strand the user on an empty result after deletion. I changed the implementation so that: Search count and rows share a read-only repeatable-read transaction. Page numbers clamp to the available range, ordering has an id tie-breaker, and thread/tag inputs and author references are validated. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
