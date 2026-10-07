# Verification: Contact Book: duplicate-email validation

[Course index](README.md)

**Implementation date:** 2026-09-08. Checks below ran on isolated working copies before the reviewed files were applied to this project.

| Check | Result |
|---|---|
| tests | Passed (exit code 0) |
| Real Chromium browser interaction | Passed |

**Automated test cases:** 4 (`test/duplicates.test.cjs`). Two were delivered with the original change; cases 3 and 4 were added in the 2026-09-17 follow-up that routed create, edit and delete through `commitContacts`.

## What was exercised

Ada owns Ada@Example.com. Creating Other with " ada@example.COM " fails. Editing Ada’s phone while keeping Ada@Example.com succeeds. Changing Bob’s email to ADA@example.com fails.

## Environment and scope

The verification environment used Node 22.16.0. Browser checks used the installed Chromium build.

Tests and builds ran in working copies with an isolated shared dependency harness. Source files were checked against the original content before application. Install this project’s declared dependencies locally to run its scripts; no running service or installed dependency tree is assumed merely because the source changes are present.

The tests target the implemented change and relevant existing behavior. They do not establish production readiness, every browser/version, multi-tab safety or every unrelated workflow. Practice extensions in chapter 5 are not completed features.

## Reproduce the checks

From this project folder: `npm install`, then `npm test`.

The authoring workspace's logs, screenshots, backups and batch reports were not committed to this repository. The pre-change source is this repository's initial commit, so `git diff -w 606e0e6 -- .` run from this project folder shows the delivered change.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w 606e0e6 -- .` from this project folder, to see only the real edits.
