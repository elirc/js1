# Kanban Flow: keyboard moves and saved order

This is a hands-on course for a junior software engineer using the actual project in `JS1/kanban-flow`. The central skill is **immutable movement, ordering invariants and keyboard access**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

## What you will be able to do

- Explain the purpose of the changed code and the data it owns.
- Trace an action from input through validation, state/persistence and output.
- Predict a success case and a failure case before running either.
- Read the regression tests and explain what each assertion proves.
- Implement a related change without copying the worked answer.
- Explain a limitation and a reasonable next step without overstating readiness.

## Prerequisites

Two things matter here: array copies and renumbering (`moveCard` builds a `candidate` copy, re-sorts each column and rewrites `order` from 0), and `localStorage` as the only store, including the fact that a second tab holding an older board will overwrite a newer one. No server, no React, no SQL.

## Start the project

Install the test dependencies from this project folder:

```powershell
npm install
npm test
```

For the app, serve this folder locally with Python:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 in a browser. Keep the terminal running; Ctrl+C stops the server. Use the same origin each time: localStorage belongs to an origin, so changing host or port creates a different storage area. The app itself has no backend or build step. `npm test` runs its actual HTML/app.js in jsdom with fresh test storage; it does not use your saved browser records.

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10**. Use the same major versions: newer patch releases are fine, older majors are untested here.

`npm test` from the project root runs `node --test test/*.test.cjs`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.cjs` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
node --test test/movement.test.cjs
```

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
2. Read chapter 1 while keeping [app.js](../app.js) open.
3. Write a prediction for the worked example in chapter 3 before executing it.
4. Run the focused test suite and explain one assertion aloud.
5. Complete the first practice exercise, then check the solution discussion.

Keep a short learning log with four fields: prediction, observed result, explanation and next question. A mismatch is useful evidence: find the exact layer where your mental model diverged from the program. Use a disposable browser profile or local test database for failure experiments so your own records are not part of the fixture.

## Scope

Moves validate targets, ignore self-drops, calculate a candidate and renumber every column before saving. Failed moves preserve state. Column selects and move-up/down buttons support keyboard use and restore focus. This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.
