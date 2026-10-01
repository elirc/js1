# Testing and debugging

[Course index](README.md)

## Run the checks

From this project folder, install dependencies and start the API plus React client:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Keep both processes running; Ctrl+C stops them. Run one learning project at a time because scaffolds may reuse ports. `npm run dev:server` and `npm run dev:client` start the two sides separately when you want separate logs.

In a second terminal, from the same project folder:

```powershell
npm test
npm run build
```

The server keeps records in memory. Creating a record changes the running process, but restarting it restores the seed dataset. The tests start a separate app instance on an ephemeral loopback port and close it after the suite. They do not call the manually running development server. The production client build is emitted under client/dist; it still needs an API to perform requests.

```text
npm test
npm run build
```
No database service is required. Inspect the repository factory in server/server.js to see seed records, the live collection and methods that mutate it. Use the Network panel to inspect JSON, then restart the server to observe the persistence boundary. HTTP tests verify the actual Express app and repository; they are not database durability tests.
## What the test suite proves

Read [test/workflow.test.js](../test/workflow.test.js). The suite targets **repeat-safe workflow history and explicit input contracts** and uses the worked fixture:

Create "Demo intake for a fictional learner" in Primary Care with status New, amount 12.50 and dueDate 2028-02-29. Request Reviewing twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project's suite runs its actual Express app over loopback HTTP against a fresh in-memory repository. The Chromium check covers the real built client and routes its API requests to that isolated real server through a local test proxy. These checks verify different boundaries; none replaces reading the test helper.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `setStatus` and inspect input types as well as values.
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
