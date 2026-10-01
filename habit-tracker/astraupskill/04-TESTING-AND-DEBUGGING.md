# Testing and debugging

[Course index](README.md)

## Run the checks

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

```text
npm test
```

## What the test suite proves

Read [test/streaks.test.cjs](../test/streaks.test.cjs). The suite targets **local dates, derived statistics and edge cases** and uses the worked fixture:

Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

In this project, jsdom runs the actual app.js against its HTML. The helper supplies browser APIs missing from jsdom and a controllable timer clock. It does not replace the app’s business functions. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `bestStreak` and inspect input types as well as values.
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

## A tradeoff the change made, and how to check it

`render` now sets `cell.setAttribute("aria-label", `${habit.name}: ${iso}`)` at `app.js:156`.
An `aria-label` does not *add* to the accessible name - it **replaces** it. Before the change a
screen reader announced the visible text, "Mon 8", plus the pressed state from `aria-pressed`.
After it, the same button announces "Read 20 pages: 2024-03-11, pressed".

That is a net improvement (the visible "Mon 8" is meaningless out of context, and the habit name
was only available by hunting up the tree for the heading), but it is a genuine tradeoff and the
course should not pretend otherwise:

- The visible label and the spoken label no longer match. A user of voice control who says
  "click Mon 8" no longer has a target with that name. `aria-labelledby` pointing at the heading
  plus the visible spans would keep both; it is more markup.
- The done/not-done state is carried **only** by `aria-pressed` (`app.js:155`). It is not in the
  words. That is correct ARIA - a toggle button's state belongs in `aria-pressed` - but it means
  a test asserting the label text proves nothing about state, and a browser or assistive
  technology that ignores `aria-pressed` gives the user nothing.
- The date is spoken as a raw ISO string. "2024-03-11" is read out digit by digit by some
  screen readers. A human-readable `Intl.DateTimeFormat` label would be friendlier and would
  make the label harder to assert in a test - which is why the delivered code chose the ISO
  form. Say that out loud rather than calling it "full accessible names".

Check it yourself: in the jsdom suite,
`app.document.querySelector('.day-cell').getAttribute('aria-label')` and `.textContent` now
return different strings. Assert both in the same test and you have documented the override.

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.

## All regression files in this project

- [test/streaks.test.cjs](../test/streaks.test.cjs)
