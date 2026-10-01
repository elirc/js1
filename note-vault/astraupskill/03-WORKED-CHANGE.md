# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Concurrent operations could read the same file version and overwrite each other. Direct target writes risked truncation. The client imported a component without mounting React.

**After:** Operations serialize through one queue. Writes use a unique sibling file and rename after writing succeeds. Failure preserves old bytes and does not poison later operations. HTTP errors are handled and Vite mounts the client correctly.

## Predict this example

With one welcome note, twelve concurrent creates leave thirteen records. Pin four created ids: those four are pinned independently of the welcome note. Reject a rename, compare original bytes, retry successfully and reopen the repository to read the result.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Reproduce the blank page first (15 minutes, and the cheapest lesson here)

Before the repository, do this. Before the change, the client did not run **at all**, and the
symptom was a white page with an empty console - no error, no stack, nothing to search for.

1. Start the API: `npm run dev:server`. Confirm it works independently of the browser:
   `curl http://localhost:4106/api/notes` returns a JSON array containing the Welcome note.
   Keep that in mind - the backend being fine is what makes this bug confusing.
2. Break the client the way it shipped. In `client/index.html`, change line 10 from
   `<script type="module" src="/src/main.jsx"></script>` back to
   `<script type="module" src="/src/App.jsx"></script>`.
3. `npm run dev:client`, open the page. You get a blank page. Open devtools. **Read what is not
   there:** no console error, no failed network request, a 200 for `App.jsx`, and a
   `<div id="root">` that exists and is empty.
4. Now explain it before you fix it. `App.jsx` contains
   `export default function App() { ... }` and nothing else. Importing a module *evaluates* it -
   the function is defined - but defining a component does not render it. Something has to call
   `createRoot(...).render(<App />)`, and nothing did. The browser did exactly what it was told.
5. Restore line 10 and look at the two lines that fix it, in `client/src/main.jsx`:

```jsx
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
```

Write the general rule in your learning log, because you will meet this again in a framework you
have not used yet: **a module that only declares things has no observable effect.** The three
entry points of a Vite React app are `index.html` (which names the script), `main.jsx` (which
mounts) and `App.jsx` (which describes); skipping the middle one is silent by construction. The
same shape of bug produces a blank page when `document.getElementById("root")` returns `null`
because the script tag runs before the div - except *that* version does throw, which makes it
easier, not harder.

## Actual implementation excerpt

The excerpt below comes from [server/repository.js](../server/repository.js) near line 6. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
export async function createNoteRepository(file, io = fs) {
  let tail = Promise.resolve();
  function serial(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  async function readAll() {
    try {
      const raw = await io.readFile(file, "utf8");
      const notes = JSON.parse(raw);
      if (!Array.isArray(notes)) throw new Error("The notes file must contain an array.");
      return notes;
    } catch (error) {
      // First run: the file (or its folder) doesn't exist yet. Seed it.
      if (error.code === "ENOENT") {
        const seed = [
          {
            id: crypto.randomUUID(),
            title: "Welcome",
            body: "This note lives in server/data/notes.json. Restart the server and it will still be here.",
            pinned: true,
            updatedAt: new Date().toISOString()
          }
        ];
        await writeAll(seed);
        return seed;
      }
      throw error;
    }
  }

  async function writeAll(notes) {
    await io.mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      await io.writeFile(temporary, JSON.stringify(notes, null, 2), { flag: "wx" });
      await io.rename(temporary, file);
    } finally {
      await io.unlink(temporary).catch(() => {});
    }
  }

  function sort(notes) {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  await serial(readAll);
  const methods = {
    async list({ search }) {
      const notes = await readAll();
      const needle = search.toLowerCase();
      const filtered = notes.filter((note) =>
        `${note.title} ${note.body}`.toLowerCase().includes(needle)
      );
      return sort(filtered);
    },
    async create(input) {
      const notes = await readAll();
      const note = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        body: input.body.trim(),
        pinned: false,
        updatedAt: new Date().toISOString()
      };
      notes.push(note);
      await writeAll(notes);
      return note;
    },
    async update(id, input) {
      const notes = await readAll();
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return null;
      notes[index] = {
        ...notes[index],
        title: input.title.trim(),
        body: input.body.trim(),
        updatedAt: new Date().toISOString()
      };
      await writeAll(notes);
      return notes[index];
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Serializing only writeFile is too late if two callers already read the same old array. A queue item must encompass read, mutation and write. Chaining onto tail establishes order. Assigning tail to result.catch keeps the queue usable while returning the original result lets the caller observe rejection. An exclusive unique sibling temporary file is written before rename changes the visible target. This does not provide a transaction across files, power-loss durability or cross-process locking. One app owns one repository; multiple workers need shared coordination or a database. Malformed JSON is an error to investigate, not a reason to reseed and overwrite data. Only ENOENT triggers initial seeding. The concurrency fixture must count the created ids, since the seeded welcome note is also pinned and its body contains the word note.

## Three variations to work through

Each is a concrete edit to [test/persistence.test.js](../test/persistence.test.js). Predict the
result, then run `node --test test/persistence.test.js`.

**Variation 1 (normal) - remove the queue and keep everything else.**
In `server/repository.js:105`, replace the wrapping line with a plain `return methods;` so the
methods are no longer passed through `serial`. Predicted result: the first test fails, and it
fails on a specific number. Twelve concurrent `create` calls each do their own `readAll()` before
any of them writes, so nearly all of them start from the same one-note array and the final file
holds **2 records, not 13** - the classic lost update. The ids are still all distinct
(`crypto.randomUUID()` never collides), so `new Set(results.map(x => x.id)).size === 12` still
passes: that assertion proves the responses were distinct, not that the writes survived. Note
which assertion actually caught the bug - `(await restarted.list({search:''})).length === 13`,
the one that re-opens the repository. Restore the line.

**Variation 2 (invalid) - send a number as the title over HTTP.**
The third test already does `post({ title: 123, body: "x" })` and asserts 400. Extend it: assert
the file on disk is **byte-identical** before and after, and count the writes. Predicted result:
zero writes. `validateNote` (`server/server.js:65-73`) runs as middleware, before the handler, so
`repository.create` is never called - the request never reaches the critical section at all.
Then try `{ title: "  a  ", body: "x" }` and predict again: also 400, because the length check
is on `title.trim()`. Then `{ title: "ok", body: 42 }`: 400 from the body check. Three different
400s, one message each - read them and decide whether the message tells the client which field
was wrong. Error text alone does not prove data integrity; the byte comparison does.

**Variation 3 (boundary) - fail the `rename` twice in a row.**
The delivered test injects one `rename` failure by flipping `fail` back to `false` inside the
stub. Change it to a counter that throws on the first **two** calls. Predicted result: two
rejected promises, the file still holding the original bytes both times, and the third call
succeeding - and, critically, the queue still working. That last part is the subtle one: `tail`
is advanced with `tail = result.catch(() => {})` at `repository.js:10`, so a rejection becomes a
*resolved* link in the chain. Delete the `.catch(() => {})` and re-run: `tail` is now a rejected
promise, so every later operation rejects with the original error, forever. That is the failure
mode the line exists to prevent, and the delivered test is the only thing that would catch its
removal. Restore it, and write down the difference between "this operation failed" and "this
queue is broken".

## Executable examples

These are the actual regression tests in [test/persistence.test.js](../test/persistence.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNoteRepository } from "../server/repository.js";
import { createApp } from "../server/server.js";
async function fixture(t) {
  const dir = await fs.mkdtemp(join(tmpdir(), "astra-notes-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return join(dir, "notes.json");
}
test("concurrent mutations serialize the entire read-modify-write and survive a new repository instance", async (t) => {
  const file = await fixture(t),
    repo = await createNoteRepository(file);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      repo.create({ title: `Note ${i}`, body: "Persisted" }),
    ),
  );
  assert.equal(new Set(results.map((x) => x.id)).size, 12);
  const restarted = await createNoteRepository(file);
  assert.equal((await restarted.list({ search: "" })).length, 13);
  await Promise.all(results.slice(0, 4).map((note) => repo.togglePin(note.id)));
  const createdIds = new Set(results.map((note) => note.id));
  assert.equal(
    (await repo.list({ search: "" })).filter(
      (x) => createdIds.has(x.id) && x.pinned,
    ).length,
    4,
  );
});
test("failed atomic rename preserves previous bytes; the queue recovers and corrupt data is not reseeded", async (t) => {
  const file = await fixture(t);
  let fail = false;
  const repo = await createNoteRepository(file, {
    ...fs,
    rename: async (...args) => {
      if (fail) {
        fail = false;
        throw new Error("simulated rename failure");
      }
      return fs.rename(...args);
    },
  });
  const before = await fs.readFile(file, "utf8");
  fail = true;
  await assert.rejects(
    repo.create({ title: "Failed", body: "x" }),
    /rename failure/,
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
  await repo.create({ title: "Retry", body: "works" });
  assert.equal((await repo.list({ search: "Retry" })).length, 1);
  await fs.writeFile(file, "{bad");
  await assert.rejects(createNoteRepository(file));
  assert.equal(await fs.readFile(file, "utf8"), "{bad");
});
test("HTTP rejects wrong types and serves a persisted create without touching development data", async (t) => {
  const file = await fixture(t);
  const app = await createApp(file);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}/api/notes`;
  const post = (body) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ title: 123, body: "x" })).status, 400);
  const response = await post({ title: "Saved note", body: "hello" });
  assert.equal(response.status, 201);
  const note = await response.json();
  assert.ok(
    JSON.parse(await fs.readFile(file, "utf8")).some((x) => x.id === note.id),
  );
  assert.equal((await fetch(url + "?search[]=bad")).status, 400);
});
test("PUT on an unknown id is 404 and the 128 kB body limit rejects an oversized note", async (t) => {
  const file = await fixture(t);
  const app = await createApp(file);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}/api/notes`;
  const json = (path, init) =>
    fetch(url + path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });

  const before = await fs.readFile(file, "utf8");

  // An id that never existed: 404, not 500, and nothing is written. The route
  // distinguishes "repository returned null" from "the repository threw".
  const missing = await json("/00000000-0000-4000-8000-000000000000", {
    method: "PUT",
    body: JSON.stringify({ title: "Ghost", body: "x" }),
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Note not found.");
  assert.equal(await fs.readFile(file, "utf8"), before);

  // Same for the two other id-addressed routes.
  assert.equal(
    (await json("/00000000-0000-4000-8000-000000000000/pin", { method: "PATCH" }))
      .status,
    404,
  );
  assert.equal(
    (await json("/00000000-0000-4000-8000-000000000000", { method: "DELETE" }))
      .status,
    404,
  );
  assert.equal(await fs.readFile(file, "utf8"), before);

  // express.json({ limit: "128kb" }) rejects before any handler runs, so the
  // body-length check in validateNote is never reached and no write happens.
  // The status is 413 and not 500: body-parser errors carry their own 4xx and
  // the error handler now passes it through instead of collapsing it.
  const oversized = await json("", {
    method: "POST",
    body: JSON.stringify({ title: "Too big", body: "x".repeat(200 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal(await fs.readFile(file, "utf8"), before);

  // Malformed JSON is the other body-parser rejection: 400, not 500.
  const malformed = await json("", { method: "POST", body: "{not json" });
  assert.equal(malformed.status, 400);
  assert.equal(await fs.readFile(file, "utf8"), before);

  // A body under both bounds is accepted, which proves the rejections above
  // were the bounds and not something else. Note there are two different
  // limits: express.json caps the whole request at 128 kB, while validateNote
  // caps the body field at 100000 characters (server.js:71) - 100 * 1024 would
  // pass the first and fail the second with a 400.
  const ok = await json("", {
    method: "POST",
    body: JSON.stringify({ title: "Just under", body: "y".repeat(90 * 1024) }),
  });
  assert.equal(ok.status, 201);
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
