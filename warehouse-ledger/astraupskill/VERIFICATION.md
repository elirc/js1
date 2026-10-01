# Verification: Warehouse Ledger: transactions and derived stock

[Course index](README.md)

Verified September 8, 2026 in isolated working copies before application to the original folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| typecheck | Passed |
| Chromium interaction | Passed |

Automated test cases: **3**.

## Tested behavior

The seeded cable stock is 40 at Main. Send two concurrent issues of 30: one succeeds, one is rejected, and the balance is 10. Force the destination credit of a transfer to fail: neither debit nor credit remains. A valid transfer of 3 leaves total stock unchanged.

The course contains additional hand-worked examples and optional exercises. These are not counted as implemented tests.

## Environment and scope

Node 22.16.0, PostgreSQL 18.1 where applicable, and dependencies installed in the isolated verification workspace were used. The exact dependency versions are recorded with the batch evidence. Floating dependency declarations remain floating; a clean dependency install was not repeated in every original folder.

Chromium used the actual built client and actual isolated Express server. A local verification proxy forwarded API requests and adjusted CORS for its temporary origin; it did not fabricate API responses. Data used a disposable PostgreSQL schema.

The browser screenshot was also captured at a 390px viewport. Measured document width: 390px. This is a layout smoke check, not a complete accessibility or device audit.

## Reproduce

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

Read [test/database.ts](../test/database.ts). PostgreSQL owns persistent rows; a unique search_path isolates each test schema. Failure triggers are created only inside that schema. If a process is interrupted, inspect its exact schema name before cleanup. The course never requires personal application data.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Limits

Number.isInteger checks the quantity rather than truncating it. A request for 1.7 units must not quietly become one unit. The bound matches the SQL integer column. The product lock is taken even for receipts so all writers participate in one ordering. Warehouse existence is checked before inserts; SQL foreign keys still protect stored references.

These are focused learning improvements, not a production-readiness certification. Existing integrations and all optional exercises are outside the checked boundary unless named above.

Delivery hashes and local course links are checked after applying the files. Logs, screenshots, diffs and backups are in AstraOrganized2/astrafinalplan/implementation/batch04. The combined report is AstraOrganized2/astrdocs/ALL_75_PROJECTS_REPORT.md.
