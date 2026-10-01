# Verification: Invoice Studio: validate first, commit together

[Course index](README.md)

Verified September 8, 2026 on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| typecheck | Passed |
| Chromium interaction | Passed |

Automated test cases: **3** delivered by Astra, plus **1** added in the fix pass, for 4 in `test/feature.test.ts`.

## Tested behavior

Create two units at 12.34, zero tax, issued 2028-02-29: total 24.68. Reject quantity [2], a three-decimal price and 2027-02-29. Force a replacement line insert to fail and verify the old invoice and lines remain intact.

The test file contains executable scenarios and assertions; the examples in the course also include hand-worked teaching variations. These are not additional tests counted in this total.

## Environment and scope

The isolated harness used Node 22.16.0, PostgreSQL 18.1 where applicable, and dependencies installed in the verification workspace. Dependency declarations using latest remain floating; the tested versions are recorded in the batch evidence. Original dependency trees and development databases were not replaced or used as fixtures.

The browser check used the actual built React client. A local test proxy forwarded its API requests to the actual isolated Express server; it did not supply fabricated API responses. The backend used a disposable PostgreSQL schema. This checks local UI/API integration, not a deployed environment.

## Reproduce

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

Read [test/database.ts](../test/database.ts) before experimenting. It assigns DATABASE_URL to a unique search_path before importing the application pool, so the tests exercise isolated tables through real HTTP. SQL failure injection is installed only in that disposable schema. An interrupted process may leave a test schema behind; inspect and remove only the exact schema owned by that run. Reusing a development database name is intentionally rejected. The source uses parameters for values; never concatenate user strings into SQL in a practice extension.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Limits

These checks target the implemented improvement and its meaningful failure boundaries. Exercises remain future learner work. The concepts and trace lab explain limits such as in-memory restart behavior, status-command semantics, date representation and transaction scope where relevant.

After copying to the original folders, delivery hashes and course links are checked by the batch verification script. Machine-readable results, command logs, screenshots, source diffs and backups are retained in AstraOrganized2/astrafinalplan/implementation/batch03. The combined report is AstraOrganized2/astrdocs/ALL_50_PROJECTS_REPORT.md.
