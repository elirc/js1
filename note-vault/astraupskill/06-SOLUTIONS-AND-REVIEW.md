# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Operations serialize through one queue. Writes use a unique sibling file and rename after writing succeeds. Failure preserves old bytes and does not poison later operations. HTTP errors are handled and Vite mounts the client correctly.

The key model is: A JSON file owns the note array. One repository instance owns a promise tail ordering every read-modify-write. Identity survives edits and restarts.

The worked fixture should behave as follows: With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

## Extension solutions

### Exercise 1

**Prompt:** Toggle one note twice concurrently.

**Approach:** Two serial toggles restore the initial flag; verify the complete record and identity.

**Review:** You are done when two concurrent `togglePin` calls on the same id leave the note **back where it started**, and you can say why. The naive implementation reads the note once, computes `!pinned` in the test, and fires two `update`-style writes with the same value - which passes for the wrong reason. Use `Promise.all([repo.togglePin(id), repo.togglePin(id)])` so each call does its own `readAll` inside the critical section, then assert `pinned === false`. Then delete the `serial(...)` wrapper on the returned methods (`repository.js:105`) and watch the same assertion pass *sometimes* - an intermittent test is worse than none, so also assert something deterministic, such as the file containing exactly the expected number of notes.

### Exercise 2

**Prompt:** Inject a pre-rename write failure.

**Approach:** Reject writeFile once and verify unchanged target bytes and cleanup of the owned temporary file.

**Review:** You are done when the target file still holds the **exact previous bytes**, compared as a string, not as a re-parsed and re-stringified object. The naive implementation asserts `JSON.parse(after).length === JSON.parse(before).length`, which cannot tell you whether the file was rewritten with different whitespace, a different key order, or a partially flushed buffer. Inject the failure between `writeFile` and `rename` (that is what makes it a *pre-rename* failure, and it is the only window in which a naive whole-file `writeFile` would have already truncated the target). Also assert the temp file is gone: `fs.readdir(dirname(file))` should show one entry, proving the `finally` at `repository.js:44` ran.

### Exercise 3

**Prompt:** Export a consistent queued snapshot.

**Approach:** Read through the queue instead of independently inspecting a file during replacement.

**Review:** You are done when the exported snapshot could not have been taken mid-write, and you can point at the line that guarantees it. The naive implementation adds an `export()` method that calls `readAll()` directly - which reads the file outside the queue and can therefore observe the moment between a `writeFile` and its `rename`, or simply interleave with a create. Route it through `serial` like every other method (`repository.js:105` does this for you automatically if you add the method to the `methods` object rather than to the returned object). Prove it: start twelve concurrent creates, call `export()` in the middle, and assert the exported array's length is one of the legal intermediate values and that every element is a complete note - never a partial object.

### Exercise 4

**Prompt:** Replace file persistence with SQLite.

**Approach:** Preserve the repository contract, migrate notes once and run the same contract tests against both adapters.

**Review:** This is the stretch design, so the deliverable is a written comparison, not an implementation. You are done when the note says what SQLite makes **unnecessary** and what it makes **harder**. Unnecessary: the promise queue (SQLite serialises writers itself, and a `BEGIN IMMEDIATE` transaction is a real critical section shared across processes - which is precisely the limit `repository.js` cannot reach), and the temp-file-plus-rename dance (the write-ahead log does that job). Harder: the repository interface currently returns plain objects read from one JSON array, so `list({search})` is a JavaScript `filter`; in SQLite you must decide between `LIKE '%x%'` (no index, and `%` from user input is a wildcard - see `newcodexJS/06-bookmark-manager` in this same batch for that exact bug) and FTS5. Name the migration path for an existing `notes.json`, and state the new failure mode: a file lock held by a crashed process.

## Ownership: reference solution

This is the solution to exercise 4b. It is **not** applied to the delivered source - the shipped
API is deliberately single-user - so the test below lives here rather than in `test/`, where it
would fail against the unmodified server. Copy both into your own branch.

### 1. An actor at the boundary (`server/server.js`)

```javascript
// An X-Actor header is not authentication. A real system verifies a signed
// session or token here; this stands in for that step so the lesson can be
// about *authorization* (who may touch what) rather than about logins.
function requireActor(req, res, next) {
  const actor = req.get("X-Actor");
  if (typeof actor !== "string" || actor.trim().length === 0) {
    return res.status(401).json({ error: "Missing X-Actor." });
  }
  req.actor = actor.trim();
  next();
}

app.use("/api/notes", requireActor);
```

Mounting it with `app.use` rather than adding it to each route is deliberate: a route added next
month inherits the check instead of forgetting it.

### 2. Ownership in the repository (`server/repository.js`)

```javascript
async create(actor, input) {
  const notes = await readAll();
  const note = {
    id: crypto.randomUUID(),
    ownerId: actor,              // from the caller, never from input
    title: input.title.trim(),
    body: input.body.trim(),
    pinned: false,
    updatedAt: new Date().toISOString()
  };
  notes.push(note);
  await writeAll(notes);
  return note;
},

async update(actor, id, input) {
  const notes = await readAll();
  const index = notes.findIndex((note) => note.id === id);
  // One lookup, two questions: does it exist, and is it yours? Returning the
  // same null for both is what makes the route answer 404 for both.
  if (index === -1 || notes[index].ownerId !== actor) return null;
  notes[index] = { ...notes[index], title: input.title.trim(), body: input.body.trim(), updatedAt: new Date().toISOString() };
  await writeAll(notes);
  return notes[index];
},

async list(actor, { search }) {
  const notes = await readAll();
  const needle = search.toLowerCase();
  return sort(notes.filter((note) =>
    note.ownerId === actor &&
    `${note.title} ${note.body}`.toLowerCase().includes(needle)
  ));
},
```

Note where the check sits: **inside** the critical section, on the same `readAll()` result that
the write is computed from. Checking ownership in the route and then calling `update` would be a
time-of-check/time-of-use gap - between the two, another queued operation could change the
owner. This project's promise queue makes that window small; a database makes it real, which is
why the equivalent SQL is `UPDATE notes SET ... WHERE id = $1 AND owner_id = $2` (one statement,
checked and written together) rather than a `SELECT` followed by an `UPDATE`.

### 3. Migration

`readAll` seeds a file that does not exist; it does not migrate one that does. Add an explicit
rule and say it out loud - silence is also a decision:

```javascript
// Notes written before ownership existed have no ownerId. Treat them as
// belonging to the legacy single user; they are invisible to everyone else.
const migrated = notes.map((note) => note.ownerId ? note : { ...note, ownerId: "legacy" });
```

The alternative - assigning them to the first caller who asks - is a privilege escalation with a
friendly face. Reject it in writing.

### 4. Reference test

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/server.js";

test("a note may not be read, updated or deleted by another actor", async (t) => {
  const dir = await fs.mkdtemp(join(tmpdir(), "astra-owner-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = join(dir, "notes.json");
  const app = await createApp(file);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => new Promise((r) => { server.close(r); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/notes`;
  const as = (actor, path = "", init = {}) => fetch(url + path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Actor": actor, ...(init.headers || {}) },
  });

  // No actor at all is 401, and it writes nothing.
  const before = await fs.readFile(file, "utf8");
  assert.equal((await fetch(url)).status, 401);
  assert.equal(await fs.readFile(file, "utf8"), before);

  // Alice creates a note. The ownerId comes from the header, not the body.
  const created = await (await as("alice", "", {
    method: "POST",
    body: JSON.stringify({ title: "Alice note", body: "secret", ownerId: "bob" }),
  })).json();
  assert.equal(created.ownerId, "alice");

  // Bob cannot see it.
  assert.deepEqual(await (await as("bob")).json(), []);

  // Bob cannot update it - and Alice's bytes are untouched.
  const beforeWrite = await fs.readFile(file, "utf8");
  const put = await as("bob", `/${created.id}`, {
    method: "PUT",
    body: JSON.stringify({ title: "Hijacked", body: "x" }),
  });
  assert.equal(put.status, 404);                     // or 403, if that is your policy
  assert.equal(await fs.readFile(file, "utf8"), beforeWrite);

  // Bob cannot delete it either, and the record is still on disk.
  assert.equal((await as("bob", `/${created.id}`, { method: "DELETE" })).status, 404);
  assert.ok(JSON.parse(await fs.readFile(file, "utf8")).some((n) => n.id === created.id));

  // Alice still can.
  assert.equal((await as("alice", `/${created.id}`, { method: "DELETE" })).status, 204);
});
```

The two file comparisons are the assertions that matter. A handler that returns 404 and *then*
writes anyway is a real bug, and a test that only checks the status code cannot see it.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/persistence.test.js](../test/persistence.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Concurrent operations could read the same file version and overwrite each other. Direct target writes risked truncation. The client imported a component without mounting React. I changed the implementation so that: Operations serialize through one queue. Writes use a unique sibling file and rename after writing succeeds. Failure preserves old bytes and does not poison later operations. HTTP errors are handled and Vite mounts the client correctly. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
