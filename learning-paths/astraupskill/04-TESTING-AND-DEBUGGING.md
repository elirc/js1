# Testing and debugging

[Course index](README.md)

## Failure lab: break the transaction on purpose

The fourth test installs a trigger that rejects the `status` activity insert and asserts the record did not change. That proves the two writes share a transaction. Now break it:

1. In `server/src/index.ts`, inside `PATCH /api/paths/:id/status`, change the activity insert from `client.query(...)` (the transaction's client) to the pooled `query(...)` helper from `./db.js`.
2. Run `npm test`. Predict which assertion fails before you look: it is the `deepEqual` of the record after the 500, because the `UPDATE` committed on the transaction client while the failing insert ran outside it (or the reverse: the insert succeeded on the pool while the transaction rolled back).
3. Read the failure, then revert the change and run again.

The lesson is mechanical and worth feeling once: a transaction is a property of a *connection*, and a query on a different connection is not inside it no matter where it sits in the source.

## This project's test harness

`test/database.ts` refuses any `ASTRA_TEST_DATABASE_URL` whose database is not named `astra_test_*`, creates a schema `astra_<uuid>`, loads `server/db/schema.sql` into it (stripping `DROP`/`CREATE EXTENSION`, so `pgcrypto` must already exist), sets `DATABASE_URL` and only then imports the app, which is why the import order in that file matters (`server/src/db.ts` builds its pool at load time). The app listens on an ephemeral loopback port; `request()` returns `{ status, data }` without throwing. `h.admin` is a second connection into the same schema used to read rows and install triggers.

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

The worked fixture is defined once in [chapter 3](03-WORKED-CHANGE.md#predict-this-example); use those exact values here.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project's suite runs its actual Express app over loopback HTTP against a disposable PostgreSQL schema. The Chromium check covers the real built client and routes its API requests to that isolated real server through a local test proxy. These checks verify different boundaries; none replaces reading the test helper.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `app.patch("/api/paths/:id/status"` and inspect input types as well as values.
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
