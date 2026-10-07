# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Search and sorting existed without an explicit status filter or matching-versus-overall summary. Equal ratings relied on source order.

**After:** Status filtering composes with search and sorting. Rating ties use title then id. The live summary distinguishes visible books from overall finished count, and sorting preserves saved order.

## Predict this example

Zebra and Alpha both have rating five and Finished status; Beta is Reading. Filter Finished, search Maya and sort by rating: Alpha then Zebra appear. Saved order remains Zebra, Alpha, Beta. An unmatched query shows zero results while overall finished stays two.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 132. It is a teaching snapshot; the
linked source is authoritative if you later edit the project. Read surrounding code for callers
and setup.

**What changed here.** The `filter` body and the whole `sort` call are new; in
`git show 606e0e6:reading-list/app.js` the same function read:

```diff
   return [...books]
     .filter((book) => {
       const searchable = `${book.title} ${book.author} ${book.status} ${book.notes}`.toLowerCase();
-      return searchable.includes(searchTerm);
+      return (statusFilter === "All" || book.status === statusFilter) && searchable.includes(searchTerm);
     })
     .sort((a, b) => {
       if (sortMode === "rating") {
-        return Number(b.rating) - Number(a.rating);
+        return Number(b.rating) - Number(a.rating) || a.title.localeCompare(b.title) || byId;
       }
-      return a[sortMode].localeCompare(b[sortMode]);
+      return String(a[sortMode]).localeCompare(String(b[sortMode])) || byId;
     });
```

Reproduce that diff yourself with
`git diff -w 606e0e6 -- app.js` from this project folder (the repository's initial commit holds the pre-change file). Two further hunks appear in it
and belong to the same change: the `let statusFilter = "All"` declaration at `app.js:26` and the
`#status-filter` change listener at `app.js:43-46`.

Three separate ideas arrived in those lines. The status predicate **composes** with the search
predicate inside one `filter` - not as a second `filter` pass over a re-assigned `books`, which
is how a saved order gets clobbered. The rating comparator became **total** by chaining
`|| title || id`, so two books with the same rating have a defined order. And the non-rating
branch grew the same `|| id` tail. The `String(...)`/`byId` coercion is a later hardening pass,
added because `a.id.localeCompare` throws on a record whose id is a number - see the "legacy
records" test in [test/filters.test.cjs](../test/filters.test.cjs).

```javascript
function getVisibleBooks() {
  return [...books]
    .filter((book) => {
      const searchable = `${book.title} ${book.author} ${book.status} ${book.notes}`.toLowerCase();
      return (statusFilter === "All" || book.status === statusFilter) && searchable.includes(searchTerm);
    })
    .sort((a, b) => {
      // Ids are coerced with String() because records written by an older build
      // (or hand-edited in localStorage) can carry a numeric id, and Number has
      // no localeCompare. The tie-break must never be the thing that throws.
      const byId = String(a.id).localeCompare(String(b.id));
      if (sortMode === "rating") {
        return Number(b.rating) - Number(a.rating) || a.title.localeCompare(b.title) || byId;
      }
      return String(a[sortMode]).localeCompare(String(b[sortMode])) || byId;
    });
}
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A view is a projection of authoritative data. Combine predicates with AND so matching search text cannot bypass the selected status. Compute the matching count from the projection and the finished count from all books. JavaScript sort mutates its input; the spread copy protects the saved array. Deterministic ties keep the display understandable when scores match. Comparing titles after ratings expresses a user-facing order, while id is a final stable tie-breaker. Tests inspect headings and serialized order because either alone misses part of the guarantee. Filters reset on reload; this change does not persist preferences or merge duplicate books.

## Three variations to work through

Each is a concrete edit to the `records` fixture at the top of
[test/filters.test.cjs](../test/filters.test.cjs). Predict the rendered order and the stored
order separately, then run `node --test test/filters.test.cjs`.

**Variation 1 (normal) - give Zebra a rating of `"4"`.**
Change `id: "z"`'s rating from `"5"` to `"4"` and leave the rest alone. Predicted result: the
rendered order stays `["Alpha", "Zebra"]`, but for a completely different reason - the first
term `Number(b.rating) - Number(a.rating)` now decides it (5 before 4) and the title and id
tie-breaks are never reached. The saved order is still `z, a, b`. This is the variation that
shows why the delivered test is weaker than it looks: it asserts an output that two different
code paths produce, so it would still pass if you deleted the `|| a.title.localeCompare(b.title)`
tail entirely. Delete that tail and watch it pass, then restore it. That is the gap the added
tie-break tests close.

**Variation 2 (invalid) - make one id a number.**
Change `id: "a"` to `id: 1`. Predicted result on the delivered comparator: a `TypeError`,
`a.id.localeCompare is not a function`, thrown inside `Array.prototype.sort`, escaping
`renderBooks`, leaving `#books` empty and the page apparently blank - with the data perfectly
intact in `localStorage`. Zero writes happen: `getVisibleBooks` is a pure read (`app.js:132`)
and the only writer is `persistBooks` at `app.js:66-68`. Predicted result on the current code:
both rows render, because the comparator coerces with `String()`. Run it both ways by temporarily
removing the coercion. The lesson is the one juniors meet as "it works on my machine": the
comparator is only ever exercised by data that exists *now*, and `localStorage` is the oldest
data in the system.

**Variation 3 (boundary) - three identical titles.**
Replace all three titles with `"Same Title"` and set `#sort` to `title`. Predicted result: the
order is `a, b, c` by id, not the insertion order `z, a, b` and not "whatever the engine does" -
that is what makes the comparator *total*. Then set `#sort` to `rating` with all three ratings
equal and confirm you get the same order through a different branch. Finally assert the stored
array is still `["z","a","b"]`: sorting happens on a copy (`[...books]` at `app.js:133`), so the
projection changed and the record did not. A comparator that returns `0` for distinct records
does not crash - it just makes the order unreproducible, which is the worst kind of bug to
chase, because it changes with the input size and the engine version.

## Executable examples

These are the actual regression tests in [test/filters.test.cjs](../test/filters.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");

const records = [
  {
    id: "z",
    title: "Zebra",
    author: "Maya",
    status: "Finished",
    rating: "5",
    notes: "JavaScript",
  },
  {
    id: "a",
    title: "Alpha",
    author: "Maya",
    status: "Finished",
    rating: "5",
    notes: "JavaScript",
  },
  {
    id: "b",
    title: "Beta",
    author: "Lin",
    status: "Reading",
    rating: "5",
    notes: "JavaScript",
  },
];
test("status, search and rating ordering compose without changing persisted order", async () => {
  const app = await openApp({ "js1-reading-list": JSON.stringify(records) });
  try {
    app.document.querySelector("#status-filter").value = "Finished";
    app.event("#status-filter", "change");
    app.document.querySelector("#search").value = "maya";
    app.event("#search", "input");
    app.document.querySelector("#sort").value = "rating";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card h2")].map(
        (x) => x.textContent,
      ),
      ["Alpha", "Zebra"],
    );
    assert.equal(
      JSON.parse(app.w.localStorage.getItem("js1-reading-list"))[0].id,
      "z",
    );
    assert.match(
      app.document.querySelector("#reading-summary").textContent,
      /Showing 2 of 3.*2 finished/,
    );
    app.document.querySelector("#search").value = "unmatched";
    app.event("#search", "input");
    assert.equal(app.document.querySelector("#empty").hidden, false);
  } finally {
    app.close();
  }
});
test("title and status sorts fall back to the id tie-break", async () => {
  const tied = [
    { id: "c", title: "Same Title", author: "Lin", status: "Reading", rating: "3", notes: "" },
    { id: "a", title: "Same Title", author: "Maya", status: "Reading", rating: "1", notes: "" },
    { id: "b", title: "Same Title", author: "Ada", status: "Reading", rating: "5", notes: "" },
  ];
  const app = await openApp({ "js1-reading-list": JSON.stringify(tied) });
  try {
    // Sorting by title: every title is identical, so the only thing that can
    // order these three rows is the id tie-break on app.js:145.
    app.document.querySelector("#sort").value = "title";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card .author")].map((x) => x.textContent),
      ["By Maya", "By Ada", "By Lin"],
      "ids a, b, c - not the insertion order c, a, b",
    );

    // Sorting by status: same reasoning, and it exercises the other branch of
    // the comparator (the non-rating branch reads a[sortMode]).
    app.document.querySelector("#sort").value = "status";
    app.event("#sort", "change");
    assert.deepEqual(
      [...app.document.querySelectorAll(".book-card .author")].map((x) => x.textContent),
      ["By Maya", "By Ada", "By Lin"],
    );

    // The saved order is a different fact from the displayed order.
    assert.deepEqual(
      JSON.parse(app.w.localStorage.getItem("js1-reading-list")).map((b) => b.id),
      ["c", "a", "b"],
    );
  } finally {
    app.close();
  }
});

test("legacy records with numeric ids sort instead of throwing", async () => {
  // Records written by an older build stored ids as numbers. String.prototype
  // .localeCompare does not exist on a Number, so an uncoerced tie-break threw
  // "a.id.localeCompare is not a function" and rendered nothing at all.
  const legacy = [
    { id: 20, title: "Same Title", author: "Lin", status: "Reading", rating: "3", notes: "" },
    { id: 3, title: "Same Title", author: "Maya", status: "Reading", rating: "3", notes: "" },
  ];
  const app = await openApp({ "js1-reading-list": JSON.stringify(legacy) });
  try {
    app.document.querySelector("#sort").value = "title";
    app.event("#sort", "change");
    const authors = [...app.document.querySelectorAll(".book-card .author")].map(
      (x) => x.textContent,
    );
    assert.equal(authors.length, 2, "both rows render; the comparator did not throw");
    // String ordering, deliberately: "20" sorts before "3". That is a real
    // consequence of coercion and it is why ids should be strings at creation
    // time - see crypto.randomUUID() in saveBook (app.js:74).
    assert.deepEqual(authors, ["By Lin", "By Maya"]);
  } finally {
    app.close();
  }
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
