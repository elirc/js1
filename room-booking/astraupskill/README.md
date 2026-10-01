# Room Booking: editable reservations and time boundaries

This is a hands-on course for a junior software engineer using the actual project in `JS1/room-booking`. The central skill is **half-open intervals, database constraints and timezones**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

## What you will be able to do

- Explain the purpose of the changed code and the data it owns.
- Trace an action from input through validation, state/persistence and output.
- Predict a success case and a failure case before running either.
- Read the regression tests and explain what each assertion proves.
- Implement a related change without copying the worked answer.
- Explain a limitation and a reasonable next step without overstating readiness.

## Prerequisites

**Read [00-PREREQS.md](00-PREREQS.md) first.** This course is the hardest in its group and it does
not staircase into `tstzrange`, GiST exclusion constraints or daylight-saving arithmetic; that
page does.

Be comfortable with variables, arrays, objects, functions, conditionals and calling a function. For React projects, review props, state and event handlers. For API projects, review JSON, HTTP methods and promises, then learn the relevant SQL operations as you trace the request. You do not need to memorize the whole repository first.

## Start the project

Install dependencies at the project root. Configure DATABASE_URL for a new empty development database. The existing db:setup script resets its tables, so use it only for that disposable setup. Run `npm run dev`, `npm run build` and `npm run typecheck` at the root. Tests use a separate astra_test_* database and run with `npm test` at the root.

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10** and **PostgreSQL 18**. Use the same major versions: newer patch releases are fine, older majors are untested here.

Create the two databases once, from `psql`, as a user allowed to create databases and schemas:

```sql
CREATE DATABASE astra_learning_sandbox;   -- the development database
CREATE DATABASE astra_test_learning;      -- the automated-test database
\c astra_test_learning
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

The test helper strips `CREATE EXTENSION` statements out of `schema.sql` before running it, so create the extensions above once in the test database (or give the test account the right to create them).

`test/booking.test.ts` refuses to run unless the database named in `ASTRA_TEST_DATABASE_URL` starts with `astra_test_`. It then creates one uniquely named schema per run and drops it at the end, so the development database is never a fixture.

`npm test` from the project root runs `tsx --test test/*.test.ts`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.ts` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
npx tsx --test test/booking.test.ts
```

**Dependencies are declared as `latest` with no lockfile; pin them before relying on a build.** An `npm install` today and the same command next month can resolve different major versions of the same packages.

## Reading and practice order

0. **[Prerequisites: ranges, exclusion constraints and days that are not 24 hours](00-PREREQS.md)**
   - start here unless you can already write an `EXCLUDE USING gist` constraint from memory. It is
   a one-hour `psql` session: `timestamptz` as an instant, `tstzrange` and why `'[)'` makes
   back-to-back meetings legal, exclusion constraints as the generalisation of `UNIQUE`, the
   SQLSTATE codes this app maps to HTTP statuses, what `btree_gist` is for (and the exact error
   you get without it), and why a local day can be 23 or 25 hours. Every block is runnable.
1. [Codebase map and reading order](01-CODEBASE-MAP.md)
2. [Concepts explained from first principles](02-CONCEPTS.md)
3. [Worked implementation and examples](03-WORKED-CHANGE.md)
4. [Tests, failure cases and debugging](04-TESTING-AND-DEBUGGING.md)
5. [Guided and independent exercises](05-PRACTICE.md)
6. [Solutions, tradeoffs and review rubric](06-SOLUTIONS-AND-REVIEW.md)
7. [Step-by-step trace lab](07-TRACE-LAB.md)
8. [Actual verification results and limits](VERIFICATION.md)

## Your first session

1. Open the app or its tests and reproduce one normal workflow.
2. Read chapter 1 while keeping [server/src/validation.ts](../server/src/validation.ts) open.
3. Write a prediction for the worked example in chapter 3 before executing it.
4. Run the focused test suite and explain one assertion aloud.
5. Complete the first practice exercise, then check the solution discussion.

Keep a short learning log with four fields: prediction, observed result, explanation and next question. A mismatch is useful evidence: find the exact layer where your mental model diverged from the program. Use a disposable browser profile or local test database for failure experiments so your own records are not part of the fixture.

## Scope

The UI edits existing ids and converts local input to explicit instants. The API validates ids, bounded text, real timestamps and forward windows. Day views send browser-local boundaries; a legacy date query explicitly means a UTC day. Database overlap enforcement is verified under concurrency and failed edits. This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.

[Existing concise codebase guide](../CODEBASE_GUIDE.md) remains available as a companion orientation.
