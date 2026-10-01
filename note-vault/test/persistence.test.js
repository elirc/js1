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
