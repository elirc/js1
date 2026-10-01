# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Counting and fetching rows in separate snapshots could disagree, and an out-of-range page could strand the user on an empty result after deletion.

**After:** Search count and rows share a read-only repeatable-read transaction. Page numbers clamp to the available range, ordering has an id tie-breaker, and thread/tag inputs and author references are validated.

## Predict this example

Create three threads that match a unique search term and a shared tag, request the list with pageSize 2, and repeat the request: both responses report total 3 and the same ids in the same order. Request page 999 of that query: the response clamps to page 2 with one item and total 3. A search with no matches clamps to page 1 with total 0. Malformed tag or author data is rejected with 400 and the thread count is unchanged.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 34. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
app.get("/api/threads", asyncRoute(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag : "";
  let page = pageNumber(req.query.page,1,1000000);
  const pageSize = pageNumber(req.query.pageSize,5,20);
  return withTransaction(async client => {
  await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const count = await client.query<{ total: string }>(`SELECT COUNT(*) AS total FROM threads t
    WHERE ($1 = '' OR t.search @@ websearch_to_tsquery('english',$1))
    AND ($2 = '' OR EXISTS (SELECT 1 FROM thread_tags x JOIN tags y ON y.id=x.tag_id WHERE x.thread_id=t.id AND y.name=$2))`,[q,tag]);
  const total = Number(count.rows[0]!.total);
  page = Math.min(page,Math.max(1,Math.ceil(total/pageSize)));
  const offset = (page - 1) * pageSize;

  const { rows } = await client.query<{
    id: string;
    title: string;
    author: string;
    snippet: string;
    created_at: string;
    tags: string[];
    total: string;
  }>(
    `SELECT t.id, t.title, u.username AS author,
            ts_headline('english', t.body, websearch_to_tsquery('english', $1),
                        'StartSel=[[, StopSel=]], MaxFragments=1, MaxWords=26, MinWords=10') AS snippet,
            to_char(t.created_at, 'YYYY-MM-DD') AS created_at,
            COALESCE(json_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), '[]') AS tags,
            COUNT(*) OVER() AS total
       FROM threads t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN thread_tags tt ON tt.thread_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE ($1 = '' OR t.search @@ websearch_to_tsquery('english', $1))
        AND ($2 = '' OR EXISTS (
              SELECT 1 FROM thread_tags x JOIN tags y ON y.id = x.tag_id
               WHERE x.thread_id = t.id AND y.name = $2))
      GROUP BY t.id, u.username
      ORDER BY ts_rank(t.search, websearch_to_tsquery('english', $1)) DESC, t.created_at DESC, t.id ASC
      LIMIT $3 OFFSET $4`,
    [q, tag, pageSize, offset]
  );


  const items: ThreadSummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    snippet: row.snippet,
    createdAt: row.created_at,
    tags: row.tags
  }));

  const payload: ThreadPage = {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
  res.json(payload);
  });
}));

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Suppose six matching threads use a five-row page. Page two has one item. Deleting it leaves five matches, so page two no longer exists. Clamp the requested page after counting, then calculate offset from the clamped value. With zero matches, retain a usable first-page representation rather than negative offsets. Stable sorting adds a unique id after the primary sort key so tied values have a deterministic order.

A REPEATABLE READ transaction makes the count and row query see the same snapshot within one request. It does not freeze results across later page requests: another user can insert or delete between clicks. The browser also has a separate responsibility when multiple searches race. This change does not add a stale-response guard; a request sequence counter or AbortController is a useful independent extension. Database consistency and latest-user-intent rendering address different boundaries.

## Three variations to work through

- **Normal variation — page past the end.** Three matching threads, `pageSize=2`, `page=999`. Predict `page: 2`, one item, `total: 3` (first test).

- **Invalid variation — a malformed tag.** `POST` with `tagNames: [{}]`. Predict 400 and no thread (second test counts). Then `?page=abc`: predict `page: 1` (`pageNumber` falls back).

- **Boundary variation — delete the last row on the last page.** Six threads, `pageSize=5`, delete the one on page 2, read page 2 again: predict page 1 with five rows and `total: 5` (third test).

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
