# Testing and debugging

[Course index](README.md)

## Run the checks

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

```text
npm test
```

## What the test suite proves

Read [test/filters.test.cjs](../test/filters.test.cjs). The suite targets **filter composition, deterministic ordering and summaries** and uses the worked fixture:

Zebra and Alpha both have rating five and Finished status; Beta is Reading. Filter Finished, search Maya and sort by rating: Alpha then Zebra appear. Saved order remains Zebra, Alpha, Beta. An unmatched query shows zero results while overall finished stays two.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

In this project, jsdom runs the actual app.js against its HTML. The helper supplies browser APIs missing from jsdom and a controllable timer clock. It does not replace the app’s business functions. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `getVisibleBooks` and inspect input types as well as values.
4. Follow validation branches, noting whether any state or persistence changed before rejection.
5. Inspect the write result and the subsequent render/response. Separate storage correctness from display correctness.
6. Add a regression reproducing the failure, make the smallest justified fix, then run the focused suite and relevant broader checks.

Avoid changing several layers at once when you do not yet know where the failure starts. A correct backend with a stale UI needs a different fix from a malformed query or an invalid saved document.

## Failure experiments

- Reuse the invalid fixture from the tests and verify no unintended records or fields change.
- Reload or restart after a successful operation to distinguish persistence from temporary screen state.
- Repeat the operation and explain whether it should be idempotent, rejected or intentionally create another record.
- Simulate the relevant timing or storage failure only in a disposable fixture. Restore normal behavior after the experiment.

## Reading an assertion failure

“Expected 3, received 4” is evidence about one observation, not a complete diagnosis. Ask whether the fixture created an extra record, the operation ran twice, an old record survived, or the assertion looked at an unfiltered collection. Start from the state table and trace the first point where the actual value diverges. A stack trace identifies where the program noticed a problem, which may be later than the code that caused it.

## Failure lab: "why is my list order changing between reloads?"

Do this before reading the fix. It takes ten minutes and it is the only way to *feel* why a
comparator has to be total.

**Step 1 - make the comparator partial again.** In `app.js:138-147`, replace the body of `sort`
with the version this change replaced:

```javascript
.sort((a, b) => {
  if (sortMode === "rating") return Number(b.rating) - Number(a.rating);
  return a[sortMode].localeCompare(b[sortMode]);
});
```

**Step 2 - build a fixture where ties matter.** In devtools on the running page:

```javascript
localStorage.setItem("js1-reading-list", JSON.stringify(
  Array.from({ length: 12 }, (_, i) => ({
    id: String(i), title: `Book ${i}`, author: "Maya",
    status: "Finished", rating: "5", notes: ""
  }))
));
location.reload();
```

Twelve books, every rating identical. Sort by rating.

**Step 3 - observe.** The order you get is the insertion order, because `sort` is stable and
your comparator returns `0` for every pair. That looks fine - which is the trap. Now add a book
through the form. `saveBook` does `books.unshift(book)` (`app.js:91`), so the new book goes to
the front of the *record*, and because the comparator cannot distinguish any of the others, the
whole rated-5 block shifts down one row. Add another. Delete one from the middle
(`deleteBook`, `app.js:116`). The list reshuffles every time, and nothing the user did was about
ordering.

**Step 4 - make it worse on purpose.** Some engines switch sorting algorithms above a threshold
(V8 historically used insertion sort for short arrays and TimSort above 10). Repeat step 2 with
`length: 3` and with `length: 200` and compare. This is why "it was fine on my data" is not
evidence: the bug's visibility depends on the array size and the engine version.

**Step 5 - diagnose it the way you would in a real codebase.** Write down the observation
("order changes after an unrelated insert"), then the hypothesis ("the comparator returns 0 for
these rows"), then the cheapest experiment that separates them:

```javascript
// paste in devtools with the app loaded
const v = getVisibleBooks();
for (let i = 1; i < v.length; i++) {
  // whatever the comparator is, log the pairs it calls equal
  if (v[i - 1].rating === v[i].rating) console.log("tie:", v[i - 1].title, v[i].title);
}
```

**Step 6 - restore the total comparator** and repeat steps 2-3. The order is now fixed by
`rating`, then `title`, then `id`, and inserting or deleting a book moves that book and nothing
else. Write one sentence for your learning log: what the stability of `Array.prototype.sort`
does and does not guarantee.

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.

## All regression files in this project

- [test/filters.test.cjs](../test/filters.test.cjs)
