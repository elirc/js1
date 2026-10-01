# Verification: Habit Tracker: calendar streaks

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3** (two delivered by the original change, one added afterwards so that `npm test` alone proves the rendered badge, not just the exported function). Together they carry roughly fourteen assertions; count assertions, not `test()` blocks, when you judge coverage.

## What the evidence covers

Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

## Environment and limits

The harness used **Node 22.16.0** with **jsdom 25.0.1** as the only dependency. This project has **no database and no server**: every check is a jsdom run of the real `app.js` plus one Chromium pass. Nothing here requires PostgreSQL or any network access. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

The browser check used fresh Chromium storage and the actual app. DOM/module tests targeted the listed transitions and failure cases.

## Reproduce

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

Machine-readable results and logs are retained in AstraOrganized2/astrafinalplan/implementation/batch02. The combined report is in AstraOrganized2/astrdocs/ALL_20_PROJECTS_REPORT.md.
