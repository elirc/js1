# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Malformed socket events could call trim on nonstrings; listener startup occurred during import and asynchronous failures could escape their handlers.

**After:** Room fields and socket messages are validated. Runtime start/stop functions enable isolated tests; malformed messages are ignored, database failures close the affected socket, and the payload size is bounded.

## Predict this example

Connect to study, wait for presence, send malformed JSON, null, and an object-valued author, then send Trace this insert. The valid message broadcasts and appears once in HTTP history. Creating study twice returns 409.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The lines below are the ones Astra changed (compare `AstraOrganized2/astrafinalplan/implementation/batch04/backups/57/server/src/index.ts` with `diff --strip-trailing-cr -w`): the event-shape guard in `connectSocket` that drops malformed or oversize events instead of crashing, the insert-only handler with a 1011 close on failure, and the listener's reconnect loop. `maxPayload: 16384` on the `WebSocketServer` is the other bound. The linked source is authoritative if you later edit the project.

```typescript
  socket.on("message", async (data) => {
    let event: ClientEvent;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (
      !event ||
      typeof event !== "object" ||
      event.type !== "message" ||
      typeof event.author !== "string" ||
      typeof event.body !== "string"
    )
      return;
    if (event.author.length > 40 || event.body.length > 2000) return;

    const author = event.author.trim().slice(0, 40) || "anonymous";
    const body = event.body.trim().slice(0, 2000);
    if (!body) return;

    // Just insert. The trigger + LISTEN loop are what actually deliver this
    // message to every connected client (including the sender).
    try {
      await query(
        "INSERT INTO messages (room_id, author, body) VALUES ($1, $2, $3)",
        [room.id, author, body],
      );
    } catch (error) {
      console.error(error);
      socket.close(1011, "Message could not be saved");
    }

// server/src/index.ts:204
async function startListener() {
  const client = createListenerClient();
  listener = client;
  client.on("error", (error) => {
    console.error("Listener error:", error.message);
    void client.end().catch(() => {});
    if (!stopping && !retry)
      retry = setTimeout(() => {
        retry = undefined;
        void startListener().catch(console.error);
      }, 1000);
  });
  await client.connect();
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A WebSocket remains open across many messages. One bad JSON message should not kill the process or prevent the next valid message. Parsing JSON checks syntax; checking type, author and body checks the protocol shape. A maximum frame payload bounds memory use independently from field-length validation.

The write path inserts into PostgreSQL. A database trigger produces a notification, the dedicated LISTEN connection receives it, and the process broadcasts to sockets in that room. This is a different path from returning an HTTP response. The integration test waits for a real message broadcast and then reads HTTP history to confirm persistence.

Starting listeners at module import makes tests unexpectedly bind ports and retain database connections. Explicit lifecycle functions put those side effects under caller control. stopRuntime terminates sockets, closes the server and listener, and clears a scheduled retry. The current reconnection attempt is bounded teaching behavior, not a durable delivery guarantee: disconnected clients recover recent history, not an acknowledged message queue. Author names remain free-form demo labels, not authenticated users.

## Three variations to work through

**Normal variation — a message from SQL.** With the app open on General, run `INSERT INTO messages (room_id, author, body) SELECT id, 'psql', 'from sql' FROM rooms WHERE slug='general'` in `psql`. Predict: the browser shows it within a second with no WebSocket frame sent by any browser. Explain which line delivered it (the trigger, then `startListener`'s `notification` handler, then `broadcast`).

**Invalid variation — a frame the guard drops.** From the browser console, `socketRef`-style access is awkward, so use the test harness: send `{"type":"message","author":3,"body":{}}` then a valid message. Predict: no broadcast for the first, one for the second, and history length +1. Then send `{"type":"message","author":"Learner","body":"   "}`: predict what `body.trim()` does and whether a row is written.

**Boundary variation — the listener dies.** Stop the listener connection from `psql` with `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query = 'LISTEN chat'`. Predict: the server logs `Listener error`, reconnects after 1 s, and any message inserted during that second is stored but never broadcast. Send one in that window, then reload the browser: the history request shows it. That is the gap exercise 4 is about.

## Executable examples

These are the actual regression tests in [test/chat.test.ts](../test/chat.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { database, request } from "./database.js";
let h: Awaited<ReturnType<typeof database>>;
before(async () => {
  h = await database();
  // Each test must be runnable on its own: the study room is fixture, not a side effect of test 1.
  await h.admin.query(
    "INSERT INTO rooms (slug, name) VALUES ('study', 'Study') ON CONFLICT (slug) DO NOTHING",
  );
});
after(async () => {
  if (h) await h.close();
});
test("room names reject malformed values and duplicate slugs", async () => {
  for (const body of [
    { slug: {}, name: "Room" },
    { slug: "bad slug", name: "Room" },
    { slug: "valid", name: [] },
  ])
    assert.equal(
      (await request(h.origin, "/api/rooms", "POST", body)).status,
      400,
    );
  assert.equal(
    (
      await request(h.origin, "/api/rooms", "POST", {
        slug: "seminar",
        name: "Seminar",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(h.origin, "/api/rooms", "POST", {
        slug: "study",
        name: "Again",
      })
    ).status,
    409,
  );
});
test("malformed socket events do not crash; valid message persists and broadcasts", async () => {
  const socket = new WebSocket(h.origin.replace("http", "ws") + "/?room=study");
  try {
    await new Promise<void>((resolve, reject) => {
      socket.on("message", (raw) => {
        if (JSON.parse(String(raw)).type === "presence") resolve();
      });
      socket.on("error", reject);
    });
    const received = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Missing broadcast")),
        5000,
      );
      socket.on("message", (raw) => {
        const event = JSON.parse(String(raw));
        if (event.type === "message") {
          clearTimeout(timer);
          resolve(event.message);
        }
      });
    });
    for (const raw of [
      "{",
      "null",
      JSON.stringify({ type: "message", author: 3, body: {} }),
    ])
      socket.send(raw);
    socket.send(
      JSON.stringify({
        type: "message",
        author: "Learner",
        body: "Trace this insert",
      }),
    );
    const message = await received;
    assert.equal(message.body, "Trace this insert");
    const history = await request(h.origin, "/api/rooms/study/messages");
    assert.equal(history.data.length, 1);
    assert.equal(history.data[0].id, message.id);
  } finally {
    socket.terminate();
  }
});

async function openSocket(slug: string) {
  const socket = new WebSocket(h.origin.replace("http", "ws") + "/?room=" + slug);
  await new Promise<void>((resolve, reject) => {
    socket.on("message", (raw) => {
      if (JSON.parse(String(raw)).type === "presence") resolve();
    });
    socket.on("error", reject);
  });
  return socket;
}
function nextMessage(socket: WebSocket, timeoutMs = 5000) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Missing broadcast")), timeoutMs);
    socket.on("message", (raw) => {
      const event = JSON.parse(String(raw));
      if (event.type === "message") {
        clearTimeout(timer);
        resolve(event.message);
      }
    });
  });
}
test("an oversize frame closes only that socket; the server keeps serving", async () => {
  const socket = await openSocket("study");
  const closed = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));
  socket.send("x".repeat(17 * 1024));
  assert.equal(await closed, 1009); // ws maxPayload: 16384 -> "message too big"
  assert.equal((await request(h.origin, "/api/rooms")).status, 200);
  const again = await openSocket("study");
  again.terminate();
});
test("a body over 2000 characters is dropped and never persisted", async () => {
  const socket = await openSocket("study");
  try {
    const before = (await request(h.origin, "/api/rooms/study/messages")).data.length;
    socket.send(JSON.stringify({ type: "message", author: "Learner", body: "y".repeat(2001) }));
    const received = nextMessage(socket);
    socket.send(JSON.stringify({ type: "message", author: "Learner", body: "after the oversize body" }));
    const message = await received;
    assert.equal(message.body, "after the oversize body");
    const history = (await request(h.origin, "/api/rooms/study/messages")).data;
    assert.equal(history.length, before + 1);
    assert.ok(history.every((m: { body: string }) => m.body.length <= 2000));
  } finally {
    socket.terminate();
  }
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
