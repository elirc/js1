# Testing and debugging

[Course index](README.md)

## Run the checks

Install the test dependencies from this project folder:

```powershell
npm install
npm test
```

For the app, serve this folder locally with Python:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 in a browser. Keep the terminal running; Ctrl+C stops the server. Use the same origin each time: localStorage belongs to an origin, so changing host or port creates a different storage area. The app itself has no backend or build step. `npm test` runs its actual HTML/app.js in jsdom with fresh test storage; it does not use your saved browser records.

```text
npm test
```
This project uses browser localStorage. In DevTools, inspect Application > Local Storage for the local origin. Refresh after an action and compare the saved JSON with the visible result. The tests create their own DOM and storage fixtures. A Node process with jsdom is useful for controlled write failures, while Chromium verifies native interaction.
## What the test suite proves

Read [test/movement.test.cjs](../test/movement.test.cjs). The suite targets **immutable movement, ordering invariants and keyboard access** and uses the worked fixture:

Move A from todo [A,B] before C in doing. B becomes order 0; A/C become orders 0/1. A self-drop does nothing. Reject setItem and the previous card array remains identical.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

In this project, jsdom runs the actual app.js against its HTML and fresh browser storage; the suite can force a storage-write failure. The Chromium check covers the real page in a native browser. These checks verify different boundaries; none replaces reading the test helper.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `moveCard` and inspect input types as well as values.
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
