# Verification: Note Vault: durable serialized writes

[Course index](README.md)

Verified on isolated working copies before application to the original project folder.

| Check | Result |
|---|---|
| tests | Passed |
| build | Passed |
| Chromium interaction | Passed |

Automated test cases: **4** (three delivered by the original change, one added afterwards for
`PUT`/`PATCH`/`DELETE` on an unknown id and for the 128 kB `express.json` limit). They carry
roughly twenty-five assertions between them.

## What the evidence covers

With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

## Environment and limits

The harness used **Node 22.16.0**. Dependencies are now pinned exactly in `package.json` and a
`package-lock.json` is committed: **express 4.21.2**, **cors 2.8.6**, **react 19.3.0**,
**react-dom 19.3.0**, **vite 8.3.0**, **@vitejs/plugin-react 6.1.1**, **concurrently 10.0.5**.
The Express major matters: on Express 5 the default query parser changes and the
`?search[]=bad` assertion in `test/persistence.test.js` returns 200 instead of 400
(`04-TESTING-AND-DEBUGGING.md` explains why). This project stores JSON on disk and uses **no
database**. No development databases or personal saved records were fixtures. The source files were verified byte-for-byte after copying into the originals.

Browser checks used the real built client with controlled API responses, verifying event wiring, rendering and error feedback. Separately, the backend tests used actual HTTP and disposable file/database persistence. The browser check is not a claim that a deployed full-stack environment was exercised end to end.

## Reproduce

From the project root run `npm install`, `npm run dev`, `npm test`, and `npm run build` as needed. Vite serves client/ and the API defaults to port 4106. Normal startup creates server/data/notes.json if absent; tests use disposable temporary files. Run one port-4106 project at a time.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.

## Boundaries

These checks cover the implemented improvements and described regression cases. They do not certify unrelated features or production readiness. Exercises in chapter 5 remain learner work. Source, test and setup limitations are explained in the concepts and trace lab.

Machine-readable results and logs are retained in AstraOrganized2/astrafinalplan/implementation/batch02. The combined report is in AstraOrganized2/astrdocs/ALL_20_PROJECTS_REPORT.md.
