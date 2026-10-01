# Verification: Reading List: composed views

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| Chromium interaction | Passed |

Automated test cases: **3**. The single delivered `test()` block carries four assertions
(composed filtering, the rendered order, the untouched saved order and the empty-view state); two
further blocks were added afterwards to cover the id tie-break on both comparator branches and a
legacy record with a numeric id. Count assertions, not `test()` blocks: one block here was doing
the work of three, which is exactly the kind of number that makes a suite look thinner or fatter
than it is.

## What the evidence covers

Zebra and Alpha both have rating five and Finished status; Beta is Reading. Filter Finished, search Maya and sort by rating: Alpha then Zebra appear. Saved order remains Zebra, Alpha, Beta. An unmatched query shows zero results while overall finished stays two.

## Environment and limits

The harness used **Node 22.16.0** with **jsdom 25.0.1** as the only dependency. This project has **no database and no server**: every check is a jsdom run of the real `app.js` plus one Chromium pass. Nothing here requires PostgreSQL or any network access. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

The browser check used fresh Chromium storage and the actual app. DOM/module tests targeted the listed transitions and failure cases.

## Reproduce

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

Machine-readable results and logs are retained in AstraOrganized2/astrafinalplan/implementation/batch02. The combined report is in AstraOrganized2/astrdocs/ALL_20_PROJECTS_REPORT.md.
