# Verification: Kanban Flow: keyboard moves and saved order

[Course index](README.md)

Verified September 8, 2026 on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3** delivered by Astra, plus **2** added in the fix pass, for 5 in `test/movement.test.cjs`.

## Tested behavior

Move A from todo [A,B] before C in doing. B becomes order 0; A/C become orders 0/1. A self-drop does nothing. Reject setItem and the previous card array remains identical.

The test file contains executable scenarios and assertions; the examples in the course also include hand-worked teaching variations. These are not additional tests counted in this total.

## Environment and scope

The isolated harness used Node 22.16.0 and dependencies installed in the verification workspace. Dependency declarations using latest remain floating; the tested versions are recorded in the batch evidence. Original dependency trees and development databases were not replaced or used as fixtures.

The actual HTML/app.js ran in jsdom with fresh storage for regressions and in Chromium for native interaction. There is no HTTP API in this project.

## Reproduce

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

This project uses browser localStorage. In DevTools, inspect Application > Local Storage for the local origin. Refresh after an action and compare the saved JSON with the visible result. The tests create their own DOM and storage fixtures. A Node process with jsdom is useful for controlled write failures, while Chromium verifies native interaction.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w 606e0e6 -- .` from this project folder, to see only the real edits.

## Limits

Single tab only: there is no `storage` event handling, so two open tabs overwrite each other (the fourth test shows it); rename uses `prompt()`; the store is `localStorage` with no server. The keyboard move control is the accessible alternative to drag-and-drop. Exercises are future learner work.

