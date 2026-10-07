# Verification: Live Chat: validate before broadcasting

[Course index](README.md)

Verified September 8, 2026 in isolated working copies before application to the original folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| typecheck | Passed |
| Chromium interaction | Passed |

Automated test cases: **2** delivered by Astra, plus **2** added in the fix pass (oversize frame, oversize body), for 4 in `test/chat.test.ts`; the study room is now created in `before()` so each test runs alone.

## Tested behavior

Connect to study, wait for presence, send malformed JSON, null, and an object-valued author, then send Trace this insert. The valid message broadcasts and appears once in HTTP history. Creating study twice returns 409.

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

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w 606e0e6 -- .` from this project folder, to see only the real edits.

## Limits

Starting listeners at module import makes tests unexpectedly bind ports and retain database connections. Explicit lifecycle functions put those side effects under caller control. stopRuntime terminates sockets, closes the server and listener, and clears a scheduled retry. The current reconnection attempt is bounded teaching behavior, not a durable delivery guarantee: disconnected clients recover recent history, not an acknowledged message queue. Author names remain free-form demo labels, not authenticated users.

These are focused learning improvements, not a production-readiness certification. Existing integrations and all optional exercises are outside the checked boundary unless named above.

The authoring workspace's logs, screenshots, backups and batch reports were not committed to this repository. The pre-change source is this repository's initial commit, so `git diff -w 606e0e6 -- .` run from this project folder shows the delivered change.
