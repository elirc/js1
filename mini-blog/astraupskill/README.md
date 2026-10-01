# Mini Blog: parent-scoped comments

This is a hands-on course for a junior software engineer using the actual project in `JS1/mini-blog`. The central skill is **relationships and validated text boundaries**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

## What you will be able to do

- Explain the purpose of the changed code and the data it owns.
- Trace an action from input through validation, state/persistence and output.
- Predict a success case and a failure case before running either.
- Read the regression tests and explain what each assertion proves.
- Implement a related change without copying the worked answer.
- Explain a limitation and a reasonable next step without overstating readiness.

## Prerequisites

Two things matter here: nested Express routes (`/api/posts/:postId/comments/:commentId` carries two params, and each level must be checked), and array-backed repositories where a "foreign key" is just a `postId` field on the child. No SQL is involved.

## Start the project

From this project folder, install dependencies and start the API plus React client:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Keep both processes running; Ctrl+C stops them. Run one learning project at a time because scaffolds may reuse ports. `npm run dev:server` and `npm run dev:client` start the two sides separately when you want separate logs.

In a second terminal, from the same project folder:

```powershell
npm test
npm run build
```

The server keeps records in memory. Creating a record changes the running process, but restarting it restores the seed dataset. The tests start a separate app instance on an ephemeral loopback port and close it after the suite. They do not call the manually running development server. The production client build is emitted under client/dist; it still needs an API to perform requests.

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10**. Use the same major versions: newer patch releases are fine, older majors are untested here.

`npm test` from the project root runs `node --test test/*.test.js`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.js` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
node --test test/api.test.js
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
2. Read chapter 1 while keeping [server/server.js](../server/server.js) open.
3. Write a prediction for the worked example in chapter 3 before executing it.
4. Run the focused test suite and explain one assertion aloud.
5. Complete the first practice exercise, then check the solution discussion.

Keep a short learning log with four fields: prediction, observed result, explanation and next question. A mismatch is useful evidence: find the exact layer where your mental model diverged from the program. Use a disposable browser profile or local test database for failure experiments so your own records are not part of the fixture.

## Scope

Posts and comments require bounded text before repository methods run. Tests verify existing parent-scoped deletion and cascade behavior. The client mount and static labels are repaired. This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.
