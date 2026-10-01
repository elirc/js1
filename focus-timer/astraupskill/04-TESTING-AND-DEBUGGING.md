# Testing and debugging

[Course index](README.md)

## Run the checks

Serve this folder over HTTP and open the printed URL: `npx serve .` or `python -m http.server 8000`. Do not double-click `index.html`. `app.js` reads `localStorage` at module load (`app.js:16` calls `loadSessions`), and over a `file://` origin several browsers either block storage outright or share one origin with every other local page, so the session log looks empty or shows someone else's records. The delivered browser check used a local HTTP server. For the automated DOM tests, run `npm install`, then `npm test` from this project folder.

```text
npm test
```

## What the test suite proves

Read [test/timer.test.cjs](../test/timer.test.cjs). The suite targets **deadlines, delayed callbacks and one-time completion** and uses the worked fixture:

A 60-second session starts at t=0. The browser delays callbacks until t=45: one tick must display 00:15, not 00:59. At t=75 the next tick completes once. If paused at 1.25 seconds, 58.75 seconds remain; a two-minute pause does not consume them.

Cases 4 and 5 cover the write boundary. With `Storage.prototype.setItem` throwing, a session that reaches its deadline logs nothing (`state.sessions.length === 0`, storage key still absent) but the timer still returns to `idle` with no interval left, and the message reads “could not be saved”; deleting a logged session under the same conditions removes nothing and says “Could not delete”.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

In this project, jsdom runs the actual app.js against its HTML. The helper supplies browser APIs missing from jsdom and a controllable timer clock. It does not replace the app’s business functions. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `tick` and inspect input types as well as values.
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
