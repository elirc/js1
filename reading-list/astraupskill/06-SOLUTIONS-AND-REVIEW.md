# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

Status filtering composes with search and sorting. Rating ties use title then id. The live summary distinguishes visible books from overall finished count, and sorting preserves saved order.

The key model is: Saved books contain id, title, author, status, rating and notes. Search, status filter and sorting are temporary view state.

The worked fixture should behave as follows: Zebra and Alpha both have rating five and Finished status; Beta is Reading. Filter Finished, search Maya and sort by rating: Alpha then Zebra appear. Saved order remains Zebra, Alpha, Beta. An unmatched query shows zero results while overall finished stays two.

## Extension solutions

### Exercise 1

**Prompt:** Add a composing author filter.

**Approach:** Derive author choices from all books and add another AND predicate; test mismatched author versus matching text.

**Review:** You are done when author, status and search all compose inside the single predicate at `app.js:134-137`, and the saved order is byte-identical before and after. The naive implementation adds a second `.filter()` chained after the first - which works - or, worse, reassigns `books = books.filter(...)`, which destroys the record and cannot be undone by clearing the filter. Show the ordinary case (author "Maya" plus status "Finished" plus search "java" yields one row) and the case that breaks a naive implementation (clear all three controls and assert all three books come back, with `localStorage` still holding `z, a, b`). The invariant: `getVisibleBooks` is a pure read; the only writer in this file is `persistBooks` at `app.js:66-68`.

### Exercise 2

**Prompt:** Persist view preferences separately.

**Approach:** Version and validate the preferences without rewriting book records.

**Review:** You are done when a reload restores the view controls *without* the view preferences ever being able to corrupt the book list. The naive implementation widens the existing `js1-reading-list` key into `{books, prefs}` - and every record already on disk is now unreadable by `loadBooks` at `app.js:61-64`, which does a bare `JSON.parse` and would hand `renderBooks` an object with no `.filter`. Use a second `localStorage` key. Then handle the case the delivered code does not: a stored `sortMode` of `"author"` or `"nonsense"` read back into `app.js:145` indexes `a[sortMode]` and yields `undefined`, which your `String()` coercion now turns into the string `"undefined"` rather than a crash - decide whether silently sorting by nothing is acceptable, or whether a stored preference should be validated against the three `<option>` values in `index.html:62-65`.

### Exercise 3

**Prompt:** Test an edit that leaves the selected status.

**Approach:** Change a Finished book to Reading; it should leave the view but remain saved with the same id.

**Review:** You are done when the test proves the edited record is *still there*, not merely that it disappeared from the view. The naive implementation asserts `.book-card` count dropped by one, which is equally consistent with the edit having deleted the book. Assert three things: the row is gone from the Finished view, `#reading-summary` says "Showing 1 of 3" (the record count did not change), and the record is retrievable by switching `#status-filter` to `All` with the **same id** it had before - read it out of `localStorage` and compare. That last check is what distinguishes a projection change from a delete, and it is the reason `saveBook` reuses `idInput.value` at `app.js:74` instead of minting a new `randomUUID()`.

### Exercise 4

**Prompt:** Introduce a deliberate locale sorting policy.

**Approach:** Use Intl.Collator with stated locale/options and fixtures containing accents and digit sequences.

**Review:** This is a design exercise; the deliverable is a written policy plus test cases. You are done when the note states which locale is used and where it comes from. The naive answer is "use `localeCompare`, it handles locales" - but `a.localeCompare(b)` with no arguments uses the *runtime's* default locale, so the same data sorts differently on a machine in Stockholm (where "ä" sorts after "z") than on one in Berlin, and your CI is a third locale again. A defensible policy names an explicit locale and options, e.g. `new Intl.Collator("en", { sensitivity: "base", numeric: true })` created **once** outside the comparator (constructing a `Collator` per comparison is a measurable cost in a sort), and says what `numeric: true` changes - "Book 2" now sorts before "Book 10". State the consequence you are accepting: a Swedish user's list is sorted by English rules. Write the test as a table of input pairs and expected sign, not as a rendered-order snapshot.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/filters.test.cjs](../test/filters.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Search and sorting existed without an explicit status filter or matching-versus-overall summary. Equal ratings relied on source order. I changed the implementation so that: Status filtering composes with search and sorting. Rating ties use title then id. The live summary distinguishes visible books from overall finished count, and sorting preserves saved order. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
