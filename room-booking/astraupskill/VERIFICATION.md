# Verification: Room Booking: editable reservations and time boundaries

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| typecheck | Passed |
| build | Passed |
| Chromium interaction | Passed |

Automated test cases: **2** `test()` blocks, carrying roughly **eighteen** assertions between
them - concurrent overlap, adjacent slots, the failed edit read back from SQL, and the validator's
rejections. Count assertions, not blocks: "2" makes this suite look far thinner than it is.

## What the evidence covers

Two requests for one room from 10:00 to 11:00 UTC yield one 201 and one 409. An adjacent 11:00-to-12:00 slot succeeds. Extending the first to 11:30 fails and preserves its old end. Renaming preserves its id. A query window ending at 11:00 excludes the adjacent slot.

## Environment and limits

The harness used **Node 22.16.0** and **PostgreSQL 18.1**. Dependencies are now pinned exactly in
`package.json` with a committed `package-lock.json`, because `npm run typecheck` and
`npm run build` are not reproducible against floating versions: express 5.2.1, pg 8.23.0,
cors 2.8.6, dotenv 17.4.2, react/react-dom 19.3.0, vite 8.3.0, @vitejs/plugin-react 6.1.1,
tsx 4.23.13, concurrently 10.0.5, typescript 5.9.3, and matching `@types/*`. TypeScript is held at
**5.9.3 deliberately**: it is the version this course's type-level claims were checked against,
and a major upgrade is a decision to make on purpose rather than by installing on a Tuesday.

Browser checks ran in **Chromium**. That matters here rather than being a formality: the edit flow
depends on how a browser treats `<input type="datetime-local" step="0.001">`, and sub-second
support is not uniform - see `02-CONCEPTS.md`, "A browser dependency the change relies on". PostgreSQL tests used a separate local PostgreSQL 18.1 instance on port 55439 and uniquely named schemas in a dedicated test database. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

Browser checks used the real built client with controlled API responses, verifying event wiring, rendering and error feedback. Separately, the backend tests used actual HTTP and disposable file/database persistence. The browser check is not a claim that a deployed full-stack environment was exercised end to end.

## Reproduce

Install dependencies at the project root. Configure DATABASE_URL for a new empty development database. The existing db:setup script resets its tables, so use it only for that disposable setup. Run `npm run dev`, `npm run build` and `npm run typecheck` at the root. Tests use a separate astra_test_* database and run with `npm test` at the root.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Database test setup

Create a dedicated PostgreSQL database such as astra_test_learning. Set your own test credentials in PowerShell:

```powershell
$env:ASTRA_TEST_DATABASE_URL = 'postgres://YOUR_TEST_USER:YOUR_TEST_PASSWORD@127.0.0.1:5432/astra_test_learning'
```

Tests reject differently named databases. The user must be allowed to create schemas. Each run creates and drops only its unique schema. This project additionally enables btree_gist and pgcrypto in this dedicated test database; it does not run the scaffold's DROP TABLE statements against a fallback namespace. Run npm test from this project's root. Interrupted runs can leave owned schemas; inspect the dedicated database before cleaning them up. Configuration must precede importing the app's database module.


## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

Machine-readable results and logs are retained in AstraOrganized2/astrafinalplan/implementation/batch02. The combined report is in AstraOrganized2/astrdocs/ALL_20_PROJECTS_REPORT.md.
