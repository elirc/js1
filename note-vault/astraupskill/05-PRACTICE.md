# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Toggle one note twice concurrently.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Inject a pre-rename write failure.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Make `writeFile` fail *after* the temp file exists but before `rename`, and prove no `.tmp`
file is left behind.

This is the narrow window the whole atomic-write design exists to survive, and the delivered test
does not test it - it fails `rename`, which is one step later. Inject the failure between the two
calls in `writeAll` (`server/repository.js:37-46`) by passing an `io` stub whose `writeFile`
creates the file and *then* throws:

```javascript
const repo = await createNoteRepository(file, {
  ...fs,
  writeFile: async (path, data, options) => {
    await fs.writeFile(path, data, options);   // the temp file now exists
    throw new Error("simulated flush failure");
  },
});
```

Capture three things before the operation: the target file's bytes, and
`await fs.readdir(dirname(file))`. After the rejection, assert all three: the target is
byte-identical (a plain `writeFile` over the target would have truncated it here - that is the
entire argument for temp-plus-rename), the directory contains exactly one entry, and a
subsequent `create` still succeeds. That middle assertion is the one that catches a missing
`finally`; delete the `finally` block at `repository.js:44` and watch a `.tmp` file accumulate
on every failure until the disk fills.

Then decide what the caller needs. Right now the rejection propagates through `wrap`
(`server/server.js:18`) to the error handler at `server.js:54-64`. A disk error carries no
`status`, so it falls to the 500 branch: "Could not complete the operation. Existing notes were
preserved." Read that sentence against
what you just proved and decide whether it is true, and whether a 500 is the right status for a
disk that is full.

## Exercise 4 — stretch design

Run a second process against the same file and show that the queue does not help - then write
the design note for what would.

Start with the demonstration, because the limit is easier to believe than to read about. Open two
terminals and run two servers on the same data file:

```
set PORT=4106 && node server/server.js
set PORT=4107 && node server/server.js
```

Both call `createNoteRepository(DATA_FILE)` (`server/server.js:11-15`), so there are now **two**
independent `tail` promises guarding one file. Hammer both with concurrent creates - a dozen
`fetch` calls to each, fired together - then count the notes in `server/data/notes.json`. You
will lose records, and the code that was carefully written to prevent exactly that will have done
its job perfectly within each process. Write down the count you got, and why
`repository.js:7-12` cannot see the other process.

Now the design note. State the current guarantee precisely: *serialised read-modify-write, and
crash-safe replacement, for a single repository instance in a single process.* State the
stronger guarantee you want: *the same, across processes.* Then compare three ways to get it and
name the new failure mode each introduces - an OS advisory lock (`proper-lockfile` or an
exclusive open; failure mode: a crashed process leaves a stale lock and everyone blocks), a
single-writer process the others talk to (failure mode: that process is now a availability
bottleneck and a deployment concern), or SQLite (failure mode: none of the file logic survives
- `list({search})` becomes SQL, and you must choose between `LIKE '%x%'`, where a user-supplied
`%` is a wildcard, and FTS5; `newcodexJS/06-bookmark-manager` in this batch ships the buggy
version of exactly that query). Say which you would pick for this app and why. Stop at the note
plus a test plan; the earlier exercises must still run.

## Exercise 4b — ownership and authorization (do not skip this one)

Every route in `server/server.js` is unauthenticated, and every note belongs to everybody. That
is fine for a single-user notebook on `localhost`, and it is the single largest gap between this
project and any CRUD job you will be paid to do. Close it.

Read `server/server.js:30-37` first and say out loud what it currently guarantees:

```javascript
app.put("/api/notes/:id", validateNote, wrap(async (req, res) => {
  const note = await repository.update(req.params.id, req.body);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.json(note);
}));
```

The only question this handler asks is **"does this id exist?"**. It never asks **"is this
caller allowed to touch it?"**. Those are different questions and they need different data.

### The task

1. Give every note an `ownerId`. `repository.create` (`server/repository.js:66-78`) must stamp
   it from the caller, never from the request body - a client that can name its own owner can
   name yours.
2. Identify the caller. Do **not** build a login system; that is a different lesson. Read an
   `X-Actor` request header and treat it as a trusted identity for now, with a comment saying
   exactly why that is a lie you are accepting on purpose. A missing or blank header is a
   **401**, not a default user.
3. Scope reads. `GET /api/notes` must return only the caller's notes. Do the filtering in the
   repository, not in the route - if the filter lives in the handler, the next handler someone
   adds will forget it.
4. Reject cross-owner writes on `PUT`, `PATCH .../pin` and `DELETE`.
5. Migrate the notes already in `notes.json`, which have no `ownerId` at all. Pick a rule and
   write it down.

### The 403-versus-404 decision

This is the part worth thinking hardest about, and there is no universally right answer:

- **403 Forbidden** is honest: "that note exists and it is not yours." It also confirms to a
  stranger that a given id exists, which is an information leak - the classic version is an
  attacker enumerating ids to learn how many customers you have.
- **404 Not Found** leaks nothing: a note you may not see is indistinguishable from a note that
  does not exist. It is harder to debug and it will confuse your own support team.

Choose one, apply it **consistently across all three write routes**, and write one sentence in
the code saying which threat you decided mattered. Then write the test for the *other* one and
watch it fail, so you know the choice is actually enforced rather than accidental.

### Acceptance tests you must write

- Alice creates a note; Bob's `GET /api/notes` does not contain it.
- Bob `PUT`s Alice's id with a valid body: the status is your chosen 403 or 404, **and** -
  this is the assertion juniors forget - Alice's note is **unchanged on disk**. Read the file
  and compare, do not trust the response.
- Bob `DELETE`s Alice's id: same status, and the record is still in the file.
- A request with no `X-Actor` header gets 401 and writes nothing.
- A `POST` whose body contains `"ownerId": "alice"` sent by Bob creates a note owned by **Bob**.

A reference implementation and a runnable test file are in
[06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md) under "Ownership: reference solution".
Attempt all five acceptance tests before you open it.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/repository.js](../server/repository.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
