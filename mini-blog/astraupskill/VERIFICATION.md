# Verification: Mini Blog: parent-scoped comments

[Course index](README.md)

Verified September 8, 2026 on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **2** delivered by Astra, plus **1** added in the fix pass, for 3 in `test/api.test.js`.

## Tested behavior

A comment under A cannot be deleted through B. Deleting A removes access to its comments. Object-valued text returns 400 and creates no comment.

The test file contains executable scenarios and assertions; the examples in the course also include hand-worked teaching variations. These are not additional tests counted in this total.

## Environment and scope

The isolated harness used Node 22.16.0 and dependencies installed in the verification workspace. Dependency declarations using latest remain floating; the tested versions are recorded in the batch evidence. Original dependency trees and development databases were not replaced or used as fixtures.

The browser check used the actual built React client. A local test proxy forwarded its API requests to the actual isolated Express server; it did not supply fabricated API responses. The backend used a fresh in-memory repository. This checks local UI/API integration, not a deployed environment.

## Reproduce

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

No database service is required. Inspect the repository factory in server/server.js to see seed records, the live collection and methods that mutate it. Use the Network panel to inspect JSON, then restart the server to observe the persistence boundary. HTTP tests verify the actual Express app and repository; they are not database durability tests.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w 606e0e6 -- .` from this project folder, to see only the real edits.

## Limits

Posts and comments live in two process-local arrays; a restart reseeds them and there is no transaction. Cascading delete is an array filter, correct for one process and the wrong tool for a database (`ON DELETE CASCADE`). Exercises are future learner work.

