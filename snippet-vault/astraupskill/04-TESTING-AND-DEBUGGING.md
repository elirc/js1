# Testing and debugging

[Course index](README.md)

## Run the checks

Serve the project over HTTP with `npx serve .` (the project's own root README offers this first), then open the address it prints - usually http://localhost:3000. ES modules cannot be opened through `file://`: the browser refuses cross-origin module requests for a `file:` page, so `index.html` opened by double-clicking shows an empty list and a CORS error. Any static server will do; `python -m http.server 8000` works too if you would rather not install anything, but this is a JavaScript project and should not need Python. Run `npm test` with Node 22 for the module checks.

```text
npm test
```

## What the test suite proves

Read [test/store.test.js](../test/store.test.js). The suite targets **ES modules, normalization and rejected promises** and uses the worked fixture:

Tags Utility,utility, EVENTS,events become Utility and EVENTS. A failed title-edit write leaves saved and in-memory titles unchanged. Clipboard rejection resolves false instead of producing an unhandled rejection.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project has no plain app.js: its pure tests verify the state helpers' data behavior directly, and the component and browser checks verify that the controls call those helpers correctly. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `saveSnippet` and inspect input types as well as values.
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

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.

## All regression files in this project

- [test/store.test.js](../test/store.test.js)
