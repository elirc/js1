# Testing and debugging

[Course index](README.md)

## Run the checks

Use Node, npm and a local PostgreSQL installation with `psql` available. From this project folder:

```powershell
npm install
```

Create an empty disposable learning database using your local PostgreSQL account. Set the connection string explicitly in the same PowerShell terminal (replace the example credentials with your local ones):

```powershell
$env:DATABASE_URL = 'postgres://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/astra_learning_sandbox'
psql $env:DATABASE_URL -f server/db/schema.sql
npm run dev
```

The schema script resets this app's tables and seeds sample records; use your dedicated learning database for that reset. The database must already exist. This direct PowerShell command avoids the inherited `db:setup` script's POSIX-style `$DATABASE_URL` expansion. You can instead configure DATABASE_URL in a local .env file for the Node server; `psql` does not automatically load .env, so set its environment value separately. Open the local client URL Vite prints. Run one project at a time to avoid shared development port conflicts.

For regression tests, use a separate existing database whose name begins `astra_test_`:

```powershell
$env:ASTRA_TEST_DATABASE_URL = 'postgres://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/astra_test_learning'
npm test
npm run typecheck
npm run build
```

The test database account needs permission to create and drop its own schemas. The helper creates a unique schema, loads the app's schema/seed data there, starts the real API on an ephemeral loopback port, and drops that schema on normal completion. A test database with pgcrypto available matches the schema's UUID generation requirements. The helper refuses names without the test prefix. It does not use the manually running development server.

```text
npm test
npm run typecheck
npm run build
```
Read [test/database.ts](../test/database.ts) before experimenting. It assigns DATABASE_URL to a unique search_path before importing the application pool, so the tests exercise isolated tables through real HTTP. SQL failure injection is installed only in that disposable schema. An interrupted process may leave a test schema behind; inspect and remove only the exact schema owned by that run. Reusing a development database name is intentionally rejected. The source uses parameters for values; never concatenate user strings into SQL in a practice extension.
## What the test suite proves

Read [test/workflow.test.ts](../test/workflow.test.ts). The suite targets **atomic status transitions, consistent pages and calendar dates** and uses the worked fixture:

Create "Intermittent checkout latency" in Availability with status Open, amount 12.50 and dueDate 2028-02-29. Request Investigating twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item. A forced activity-insert failure leaves both the record and its prior history unchanged.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project's suite runs its actual Express app over loopback HTTP against a disposable PostgreSQL schema. The Chromium check covers the real built client and routes its API requests to that isolated real server through a local test proxy. These checks verify different boundaries; none replaces reading the test helper.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `app.patch("/api/incidents/:id/status"` and inspect input types as well as values.
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
