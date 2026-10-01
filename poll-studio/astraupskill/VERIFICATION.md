# Verification: Poll Studio: stable options and reliable edits

[Course index](README.md)

Verified September 8, 2026 on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3**.

## Tested behavior

Remove Mobile app from the starter poll. Public API retains 7 votes and Dark mode retains 2, for 9 total. Duplicate labels API/api are rejected. A failed write preserves both the old poll and the current draft.

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

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Limits

Everything is in one browser tab: `localStorage` is the whole store, a second tab does not see this tab's changes until it reloads, and there is no server to validate anything. The `commitPolls` helper is the only write path; failures are simulated by making `setItem` throw. Exercises are future learner work.

