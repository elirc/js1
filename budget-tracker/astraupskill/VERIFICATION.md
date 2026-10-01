# Verification: Budget Tracker: cents and safe commits

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **4** (two delivered by the original change, two added afterwards: legacy
records with more than two decimals, and the zero-amount edit decision). They carry roughly
thirty assertions between them.

## What the evidence covers

Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

## Environment and limits

The harness used **Node 22.16.0** with **jsdom 25.0.1** as the only dependency, now pinned exactly in `package.json` with a committed `package-lock.json`. This project has **no database and no server**: every check is a jsdom run of the real `app.js` plus one Chromium pass. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

The browser check used fresh Chromium storage and the actual app. DOM/module tests targeted the listed transitions and failure cases.

## Reproduce

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

Machine-readable results and logs are retained in AstraOrganized2/astrafinalplan/implementation/batch02. The combined report is in AstraOrganized2/astrdocs/ALL_20_PROJECTS_REPORT.md.
