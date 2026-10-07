# Verification: Campaign Planner: reliable workflow and history

[Course index](README.md)

Verified September 8, 2026 on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3**.

## Tested behavior

Create a record titled "A lesson record" (the exact fixture in `test/workflow.test.*`; the seeded UI uses domain titles such as "Autumn email welcome campaign") in category Email with status Planning, amount 12.5 and dueDate 2028-02-29. Request Active twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item.

The test file contains executable scenarios and assertions; the examples in the course also include hand-worked teaching variations. These are not additional tests counted in this total.

## Environment and scope

The isolated harness used Node 22.16.0 and dependencies installed in the verification workspace. Dependency declarations using latest remain floating; the tested versions are recorded in the batch evidence. Original dependency trees and development databases were not replaced or used as fixtures.

The browser check used the actual built React client. A local test proxy forwarded its API requests to the actual isolated Express server; it did not supply fabricated API responses. The backend used a fresh in-memory repository. This checks local UI/API integration, not a deployed environment.

The shared toolbar was checked at 1280px for a usable search width, and the page at 390px for no horizontal overflow. Screenshots are retained with the browser results.

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

These checks target the implemented improvement and its meaningful failure boundaries. Exercises remain future learner work. The concepts and trace lab explain limits such as in-memory restart behavior, status-command semantics and date representation where relevant.

The authoring workspace's logs, screenshots, backups and batch reports were not committed to this repository. The pre-change source is this repository's initial commit, so `git diff -w 606e0e6 -- .` run from this project folder shows the delivered change.
