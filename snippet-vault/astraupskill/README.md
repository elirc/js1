# Snippet Vault: storage and clipboard failure

This is a hands-on course for a junior software engineer using the actual project in `JS1/snippet-vault`. The central skill is **ES modules, normalization and rejected promises**. The implementation is already present: use it as a worked example, then recreate a small variation independently.

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

Serve the project over HTTP with `npx serve .` (the project's own root README offers this first), then open the address it prints - usually http://localhost:3000. ES modules cannot be opened through `file://`: the browser refuses cross-origin module requests for a `file:` page, so `index.html` opened by double-clicking shows an empty list and a CORS error. Any static server will do; `python -m http.server 8000` works too if you would rather not install anything, but this is a JavaScript project and should not need Python. Run `npm test` with Node 22 for the module checks.

The commands are run from this project’s folder, not from the Desktop inventory repository. Existing README/Fable material remains available. This folder teaches the implemented change and points to executable source and tests rather than replacing older guides.

### Toolchain

This course was delivered and verified on **Node 22.16.0**, **npm 10**. Use the same major versions: newer patch releases are fine, older majors are untested here.

`npm test` from the project root runs `node --test test/*.test.js`. npm runs scripts through `cmd.exe` on Windows, and `cmd.exe` does not expand the `test/*.test.js` glob; neither does PowerShell for a native command. Node's own test runner expands the pattern (Node 21+), so `npm test` works on Node 22 - but on an older Node, or with a different runner, you will see "no test files". The shell-independent equivalent is:

```powershell
node --test test/store.test.js
```

## Reading and practice order

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
2. Read chapter 1 while keeping [src/store.js](../src/store.js) open.
3. Write a prediction for the worked example in chapter 3 before executing it.
4. Run the focused test suite and explain one assertion aloud.
5. Complete the first practice exercise, then check the solution discussion.

Keep a short learning log with four fields: prediction, observed result, explanation and next question. A mismatch is useful evidence: find the exact layer where your mental model diverged from the program. Use a disposable browser profile or local test database for failure experiments so your own records are not part of the fixture.

## Scope

Create, edit and delete publish only after persistence succeeds. Tags deduplicate case-insensitively, missing edit ids and blank content are rejected, and clipboard denial returns false so the UI can explain failure. This is one bounded improvement, not certification of every feature. Read VERIFICATION.md for checks actually executed. Exercises are intentionally future practice; do not confuse them with completed implementation.

[Existing concise codebase guide](../CODEBASE_GUIDE.md) remains available as a companion orientation.
