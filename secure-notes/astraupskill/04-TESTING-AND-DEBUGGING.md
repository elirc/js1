# Testing and debugging

[Course index](README.md)

## This project's test harness

`test/http.js` imports the exported `app`, listens on port 0 of 127.0.0.1 and returns `{ origin, close }`; `close()` calls `server.closeAllConnections()` so keep-alive sockets do not hold the process open. `test/notes.test.js` defines its own `api(path, method, body, token)` helper that adds `Authorization: Bearer <token>` when a token is passed, and the `before` hook registers two users and keeps both tokens (`a`, `b`) for the whole file. That is how one test can act as the owner and as a stranger without re-logging. The new expiry test sets `SESSION_TTL_MS` only around one login call, because `issueSession` reads the variable at call time, not at import time. Run everything with `npm test` (`node --test test/*.test.js`; Node 22 expands the pattern itself).

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

Read [test/notes.test.js](../test/notes.test.js). The suite targets **authorizing records and rejecting malformed JSON** and uses the worked fixture:

User A creates Learning note. User B sees an empty note list and receives 404 for A's detail, edit and delete paths. An invalid body leaves the old note intact. After A logs out, the old token receives 401.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project runs its real Express app through HTTP with fresh in-memory data. Browser checks exercise the built client separately. Read the project verification page for the exact observed checks and limits.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `requireAuth` and inspect input types as well as values.
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
