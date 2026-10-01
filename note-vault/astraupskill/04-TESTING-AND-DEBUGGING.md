# Testing and debugging

[Course index](README.md)

## Run the checks

From the project root run `npm install`, `npm run dev`, `npm test`, and `npm run build` as needed. Vite serves client/ and the API defaults to port 4106. Normal startup creates server/data/notes.json if absent; tests use disposable temporary files. Run one port-4106 project at a time.

```text
npm test
```

## What the test suite proves

Read [test/persistence.test.js](../test/persistence.test.js). The suite targets **async queues, atomic file replacement and repositories** and uses the worked fixture:

With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `createNoteRepository` and inspect input types as well as values.
4. Follow validation branches, noting whether any state or persistence changed before rejection.
5. Inspect the write result and the subsequent render/response. Separate storage correctness from display correctness.
6. Add a regression reproducing the failure, make the smallest justified fix, then run the focused suite and relevant broader checks.

Avoid changing several layers at once when you do not yet know where the failure starts. A correct backend with a stale UI needs a different fix from a malformed query or an invalid saved document.

## Failure experiments

- Reuse the invalid fixture from the tests and verify no unintended records or fields change.
- Reload or restart after a successful operation to distinguish persistence from temporary screen state.
- Repeat the operation and explain whether it should be idempotent, rejected or intentionally create another record.
- Simulate the relevant timing or storage failure only in a disposable fixture. Restore normal behavior after the experiment.

## Reading an assertion failure

“Expected 3, received 4” is evidence about one observation, not a complete diagnosis. Ask whether the fixture created an extra record, the operation ran twice, an old record survived, or the assertion looked at an unfiltered collection. Start from the state table and trace the first point where the actual value diverges. A stack trace identifies where the program noticed a problem, which may be later than the code that caused it.

## A bug the new test found: a client error reported as a server error

Writing the fourth test - the one that checks the 128 kB `express.json` limit - turned up a real
defect in the delivered code, and it is a good example of why "add coverage for behaviour you
already shipped" is worth doing.

The error handler used to read:

```javascript
res.status(error.status === 400 ? 400 : 500).json({ error: "Could not complete the operation. ..." });
```

Send a 200 kB note and `express.json({ limit: "128kb" })` (`server/server.js:16`) rejects it
before any handler runs, throwing an error whose `status` is **413 Payload Too Large**. `413`
is not `400`, so the ternary fell through and the client got **500 Internal Server Error**.
Malformed JSON took the same path.

Why that matters beyond the number: 4xx means *you sent something I cannot accept, change it and
retry*; 5xx means *I am broken, retrying might work*. Collapsing the first into the second tells
a client to retry a request that can never succeed, makes a bad request indistinguishable from a
failing disk in your logs, and - on any real deployment - trips the alert you set up for your
500 rate every time someone pastes a large document.

The handler now preserves any 4xx the error carries:

```javascript
const status = Number(error.status ?? error.statusCode);
if (Number.isInteger(status) && status >= 400 && status < 500) {
  return res.status(status).json({ error: "The request was rejected. Existing notes were preserved." });
}
console.error("Note storage operation failed:", error.message);
res.status(500).json({ error: "Could not complete the operation. Existing notes were preserved." });
```

Note the second change: the 4xx branch does not `console.error`. Client mistakes are not
incidents, and logging them at error level is how a log becomes noise nobody reads.

The regression is the fourth test in [test/persistence.test.js](../test/persistence.test.js):
oversized body → **413**, malformed JSON → **400**, both with the file byte-identical
afterwards. Revert the handler and both assertions fail with 500.

## A reproducibility trap this project actually hit

Every dependency in `package.json` used to be `"latest"`, with no `package-lock.json`. That is
not a style complaint; it silently changes what the tests mean. Reinstalling this project a year
after delivery resolved `express` to **5.x**, and one delivered assertion flipped:

```javascript
assert.equal((await fetch(url + "?search[]=bad")).status, 400);
```

In Express 4 the default query parser is `qs` ("extended"), so `?search[]=bad` arrives as
`req.query.search === ["bad"]` - an array, which the guard at `server/server.js:21` rejects with
400. In Express 5 the default parser is Node's own `querystring` ("simple"), so the key is the
literal string `"search[]"`, `req.query.search` is `undefined`, the `= ""` default in
`const { search = "" } = req.query` takes over, and the request succeeds with **200**. The test
failed, the code was unchanged, and nothing in the repository recorded which Express the
assertion was written against.

Two lessons, and the second is the important one:

1. Pin your dependencies and commit the lockfile. `package.json` now names exact versions and
   `package-lock.json` is committed. `npm ci` reproduces them exactly; `npm install` may not.
2. **A test that depends on a framework default is testing the framework.** If you want a
   non-string `search` rejected regardless of parser, set the parser explicitly
   (`app.set("query parser", "extended")`) and say so in a comment, or validate the raw query
   string. Find every assertion in your own suites that would change if a dependency's default
   changed - there are usually more than you expect.

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.

## All regression files in this project

- [test/persistence.test.js](../test/persistence.test.js)
