# Verification: Flashcards: finite study sessions

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3** (two delivered by the original change, one added afterwards for the restart path), carrying roughly twenty assertions between them. Count the assertions, not the `test()` blocks, when you judge coverage.

## What the evidence covers

JS contains a unknown and b known; CSS contains c unknown. Select JS and unlearned-only: the session contains just a. Reveal and mark it known: progress becomes Completed 1 of 1 and grading is disabled. Restarting now finds no eligible cards. A rejected write instead keeps a at index zero.

## Environment and limits

The harness used **Node 22.16.0** with **jsdom 25.0.1** as the only dependency. This project has **no database and no server**: every check is a jsdom run of the real `app.js` plus one Chromium pass. Nothing in this course requires PostgreSQL or any network access. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

The browser check used fresh Chromium storage and the actual app. DOM/module tests targeted the listed transitions and failure cases.

## Reproduce

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w 606e0e6 -- .` from this project folder, to see only the real edits.

## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

The authoring workspace's logs, screenshots, backups and batch reports were not committed to this repository. The pre-change source is this repository's initial commit, so `git diff -w 606e0e6 -- .` run from this project folder shows the delivered change.
