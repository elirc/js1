# Verification: Task Board: persistent undo

[Course index](README.md)

**Implementation date:** 2026-09-08. Checks below ran on isolated working copies before the reviewed files were applied to this project.

| Check | Result |
|---|---|
| tests | Passed (exit code 0) |
| Real Chromium browser interaction | Passed |

**Automated test cases:** 5 (`test/undo.test.cjs`). Three were delivered with the original change; cases 4 and 5 were added in the 2026-09-17 follow-up that routed create and edit through `commitBoard`.

## What was exercised

Start with task ids [a, b, c]. Delete b: visible ids become [a, c] and recovery stores b at index 1. Reload. Undo: ids become [a, b, c], and recovery becomes null. A second undo changes nothing.

Cases 4 and 5 cover the create path: after deleting b, submitting a task titled "New task" stores ['New task', 'a', 'c'] and leaves the recovery record for b intact; the same submit with `Storage.prototype.setItem` throwing leaves two tasks in memory, leaves the recovery record intact, and reports "Could not save".

**Follow-up run, 2026-09-17:** `node --test test/undo.test.cjs` on Node 22.16.0 with jsdom 25 installed -> `# tests 5 / # pass 5 / # fail 0`. Note that `node --test test/` (directory form) fails with MODULE_NOT_FOUND on this Node build; name the file, or use `npm test`, which passes the glob to Node's runner.

## Environment and scope

The verification environment used Node 22.16.0. Browser checks used the installed Chromium build.

Tests and builds ran in working copies with an isolated shared dependency harness. Source files were checked against the original content before application. Install this project’s declared dependencies locally to run its scripts; no running service or installed dependency tree is assumed merely because the source changes are present.

The tests target the implemented change and relevant existing behavior. They do not establish production readiness, every browser/version, multi-tab safety or every unrelated workflow. Practice extensions in chapter 5 are not completed features.

## Reproduce the checks

From this project folder: `npm install`, then `npm test`.

The central implementation report in AstraOrganized2/astrafinalplan/TEN_PROJECTS_IMPLEMENTED.md links all ten courses. Machine-readable check results and logs are retained with the implementation tooling in that repository.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.
