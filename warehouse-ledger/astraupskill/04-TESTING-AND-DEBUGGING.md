# Testing and debugging

[Course index](README.md)

## This project's test harness: `test/database.ts`

`database()` refuses any `ASTRA_TEST_DATABASE_URL` whose database name does not start with `astra_test_`, creates a private schema `astra_<uuid>`, loads `server/db/schema.sql` into it after stripping the `DROP ...` and `CREATE EXTENSION` lines (the teaching script is destructive on purpose; the extension must already exist in the test database), and only then assigns `process.env.DATABASE_URL` and does `await import("../server/src/index.js")`. That order is essential: `server/src/db.ts` creates its `Pool` from `DATABASE_URL` when the module loads, so importing the app first would bind it to the wrong database. `close()` drops the schema. The second and third tests use `h.admin` (a superuser connection into the same schema) to read `SUM(delta)` and `count(*)` directly, which is how they check what was committed rather than what the API says. Run with `$env:ASTRA_TEST_DATABASE_URL = "postgres://user@127.0.0.1:5432/astra_test_yourname"` then `npm test`.

## Run the checks

Use Node.js, npm and a local PostgreSQL server with psql on PATH. From this project root:

```powershell
npm install
$env:DATABASE_URL = 'postgres://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/astra_learning_sandbox'
psql $env:DATABASE_URL -f server/db/schema.sql
npm run dev
```

Create that empty learning database first with your local PostgreSQL account. The schema script resets the app tables and adds its sample records, so use a dedicated disposable learning database. The explicit PowerShell command avoids the inherited POSIX-style db:setup variable expansion. psql does not read a Node .env file automatically. Open the URL printed by Vite and keep the API/client running.

For regression tests, create a different database with an astra_test_ prefix:

```powershell
$env:ASTRA_TEST_DATABASE_URL = 'postgres://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/astra_test_learning'
npm test
npm run typecheck
npm run build
```

The account must be able to create/drop schemas. The helper refuses a non-test database name, creates a unique schema, loads the actual app SQL there, assigns the connection before importing the app and removes its schema on normal completion. Tests use a random local port and never call your manually running API. The app build is a client build; the API still runs separately.

```text
npm test
npm run typecheck
npm run build
```
Read [test/database.ts](../test/database.ts). PostgreSQL owns persistent rows; a unique search_path isolates each test schema. Failure triggers are created only inside that schema. If a process is interrupted, inspect its exact schema name before cleanup. The course never requires personal application data.
## What the test suite proves

Read [test/ledger.test.ts](../test/ledger.test.ts). The suite targets **protecting a balance under concurrent writes** and uses the worked fixture:

The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project runs its real Express app through HTTP with a disposable PostgreSQL database. Browser checks exercise the built client separately. Read the project verification page for the exact observed checks and limits.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `lockProduct` and inspect input types as well as values.
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
