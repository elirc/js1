# Verification: Legal Case Tracker: dependable record editing

[Course index](README.md)

Verified September 8, 2026 in isolated working copies before application to the original folder.

| Check | Result |
|---|---|
| build | Passed |
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3**.

## Tested behavior

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Intake to Discovery, then repeat Discovery: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

The course contains additional hand-worked examples and optional exercises. These are not counted as implemented tests.

## Environment and scope

Node 22.16.0 and dependencies installed in the isolated verification workspace were used. The exact dependency versions are recorded with the batch evidence. Floating dependency declarations remain floating; a clean dependency install was not repeated in every original folder.

Chromium used the actual built client and actual isolated Express server. A local verification proxy forwarded API requests and adjusted CORS for its temporary origin; it did not fabricate API responses. Data used a fresh in-memory repository.

The browser screenshot was also captured at a 390px viewport. Measured document width: 390px. This is a layout smoke check, not a complete accessibility or device audit.

## Reproduce

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

The server memory owns records. Use the Network panel to compare request JSON and response JSON, then restart the API to distinguish process memory from durable storage. The regression helper imports the actual app and calls it through HTTP.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Limits

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. Synchronous array operations cannot interleave midway through an await because there is no await in that boundary. This explanation is specific to one process. Adding disk I/O or multiple API instances requires a new coordination design.

These are focused learning improvements, not a production-readiness certification. Existing integrations and all optional exercises are outside the checked boundary unless named above.

Delivery hashes and local course links are checked after applying the files. Logs, screenshots, diffs and backups are in AstraOrganized2/astrafinalplan/implementation/batch04. The combined report is AstraOrganized2/astrdocs/ALL_75_PROJECTS_REPORT.md.
