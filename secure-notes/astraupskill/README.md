# Secure Notes: owned CRUD and runtime boundaries

This is a hands-on course for a junior software engineer using the actual project in `JS1/secure-notes`. The central skill is **authorizing records and rejecting malformed JSON**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

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

From the project root, use Node.js and npm:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The React client and Express API both need to remain running. Run one project at a time if their ports conflict. In another terminal in this project:

```powershell
npm test
npm run build
```

The API data is in memory. Refreshing the browser keeps the API process alive; restarting the API rebuilds its initial data. Tests start a separate server on a random loopback port and close it afterward. No PostgreSQL service is required.

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10**. Use the same major versions: newer patch releases are fine, older majors are untested here.

`npm test` from the project root runs `node --test test/*.test.js`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.js` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
node --test test/notes.test.js
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

What Astra changed: a JSON-object guard for every write, typed and bounded credentials and note fields (password 6-128, title 2-200, body up to 20,000), email normalization applied identically on register and login, and a new owner-scoped `GET /api/notes/:id`. What already existed before the change and is used as the worked example: `requireAuth`, `findOwnedNote` owner checks on read, update and delete, and logout revoking its token. Added in this course's fix pass: sessions now expire (`expiresAt` returned on login, 401 `Session expired.` afterwards). This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.
