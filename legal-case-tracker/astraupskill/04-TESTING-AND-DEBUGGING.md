# Testing and debugging

[Course index](README.md)

## This project's test harness

`test/http.js` imports the exported `app` from `server/server.js`, listens on port 0 of 127.0.0.1 (the OS picks a free port), and returns `{ origin, close }`. `request(origin, path, method, body)` is a thin `fetch` wrapper that returns `{ status, data }` and never throws on a 4xx, which is why the tests can assert `status === 400` and then re-read the record. The server module is loaded once per test process, so all three tests share one in-memory repository; run the suite with `npm test` (which is `node --test test/`, the directory form that works in PowerShell and cmd.exe alike).

## Run the checks

From the project root, use Node.js and npm:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The React client and Express API both need to remain running. Run one project at a time if their ports conflict. In another terminal in this project:

```powershell
npm test
npm run build
```

The API data is in memory. Refreshing the browser keeps the API process alive; restarting the API rebuilds its initial data. Tests start a separate server on a random loopback port and close it afterward. No PostgreSQL service is required.

```text
npm test
npm run build
```
The server memory owns records. Use the Network panel to compare request JSON and response JSON, then restart the API to distinguish process memory from durable storage. The regression helper imports the actual app and calls it through HTTP.
## What the test suite proves

Read [test/workflow.test.js](../test/workflow.test.js). The suite targets **runtime validation, stable pagination and repeat-safe status history** and uses the worked fixture:

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Intake to Discovery, then repeat Discovery: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project runs its real Express app through HTTP with fresh in-memory data. Browser checks exercise the built client separately. Read the project verification page for the exact observed checks and limits.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `createRepository` and inspect input types as well as values.
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
