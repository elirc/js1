# Vendor Contracts: reliable workflow and history

> **Same lesson as [Learning Paths: reliable workflow and history](../../learning-paths/astraupskill/README.md)** - this course is a near-identical rendering with different nouns. Do the canonical one; use this project only as a second, independent practice run.

This is a hands-on course for a junior software engineer using the actual project in `JS1/vendor-contracts`. The central skill is **atomic status transitions, consistent pages and calendar dates**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

## What you will be able to do

- Explain the purpose of the changed code and the data it owns.
- Trace an action from input through validation, state/persistence and output.
- Predict a success case and a failure case before running either.
- Read the regression tests and explain what each assertion proves.
- Implement a related change without copying the worked answer.
- Explain a limitation and a reasonable next step without overstating readiness.

## Prerequisites

Be comfortable with variables, arrays, objects, functions, conditionals and calling a function. For React projects, review props, state and event handlers. For API projects, review JSON, HTTP methods and promises, then learn the relevant SQL operations as you trace the request. You do not need to memorize the whole repository first.

## Start the project

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

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10** and **PostgreSQL 18**. Use the same major versions: newer patch releases are fine, older majors are untested here.

Create the two databases once, from `psql`, as a user allowed to create databases and schemas:

```sql
CREATE DATABASE astra_learning_sandbox;   -- the development database
CREATE DATABASE astra_test_learning;      -- the automated-test database
\c astra_test_learning
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

The test helper strips `CREATE EXTENSION` statements out of `schema.sql` before running it, so create the extensions above once in the test database (or give the test account the right to create them).

`test/database.ts` refuses to run unless the database named in `ASTRA_TEST_DATABASE_URL` starts with `astra_test_`. It then creates one uniquely named schema per run and drops it at the end, so the development database is never a fixture.

`npm test` from the project root runs `tsx --test test/*.test.ts`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.ts` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
npx tsx --test test/workflow.test.ts
```

**Dependencies are declared as `latest` with no lockfile; pin them before relying on a build.** An `npm install` today and the same command next month can resolve different major versions of the same packages.

## Reading and practice order

1. [Codebase map and reading order](01-CODEBASE-MAP.md)
2. [Concepts explained from first principles](02-CONCEPTS.md)
3. [Worked implementation and examples](03-WORKED-CHANGE.md)
4. [Tests, failure cases and debugging](04-TESTING-AND-DEBUGGING.md)
5. [Guided and independent exercises](05-PRACTICE.md)
6. [Solutions, tradeoffs and review rubric](06-SOLUTIONS-AND-REVIEW.md)
7. [Detailed trace lab and independent checkpoint](07-TRACE-LAB.md)
8. [Actual verification results and limits](VERIFICATION.md)

## Your first session

1. Open the app or its tests and reproduce one normal workflow.
2. Read chapter 1 while keeping [server/src/index.ts](../server/src/index.ts) open.
3. Write a prediction for the worked example in chapter 3 before executing it.
4. Run the focused test suite and explain one assertion aloud.
5. Complete the first practice exercise, then check the solution discussion.

Keep a short learning log with four fields: prediction, observed result, explanation and next question. A mismatch is useful evidence: find the exact layer where your mental model diverged from the program. Use a disposable browser profile or local test database for failure experiments so your own records are not part of the fixture.

## Scope

Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Status and audit writes use one row-locked transaction; count and rows share a repeatable-read snapshot. Seed dates map to the intended column. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels. This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.
