# Trace lab: Live Chat: validate before broadcasting

[Course index](README.md) · [Worked change](03-WORKED-CHANGE.md) · [Tests](04-TESTING-AND-DEBUGGING.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## The concrete case

This lab connects one visible action to the code that accepts or rejects it. Use a disposable dataset and write your prediction before running the operation. The goal is to explain what each boundary contributes, not to memorize a sequence of clicks.

Connect to study, wait for presence, send malformed JSON, null, and an object-valued author, then send Trace this insert. The valid message broadcasts and appears once in HTTP history. Creating study twice returns 409.

## Write the record before touching the form

Rooms have id, slug and name. Messages have id, roomId, author, body and createdAt. WebSockets subscribe to room IDs, while PostgreSQL LISTEN/NOTIFY delivers committed message notifications to the process.

Make a small table in your own notes with these columns: field, starting value, proposed value, and source of truth. Include identity even when the form does not display it. Include related rows or stored counters when the operation changes more than one fact. Mark a value as derived if the app recomputes it rather than storing it independently.

For example, an edit can change a title while preserving an ID. A status command can keep the same status while producing no new history. An import can contain many rows yet be rejected before any replacement begins. In each case, the meaningful observation is the promised resulting state. A success toast alone cannot establish which fields changed.

## Trace the real call path

### Boundary 1 — the composer decides what to send

`client/src/App.tsx`: `send` (line 72) trims `draft`, refuses to send if the socket is not `OPEN`, and calls `socket.send(JSON.stringify({ type: "message", author, body }))`. Room creation goes through `handleCreateRoom` (line 80) and plain HTTP. Notice what the client does not do: it does not add the message to `messages` itself. It waits for the broadcast, so the sender sees exactly what the database accepted.

### Boundary 2 — the frame leaves the browser

The effect at line 30 opens `new WebSocket(WS_URL + "/?room=" + slug)` (`client/src/api.ts` exports `WS_URL`), re-fetches history with `listMessages(slug)`, and reconnects after 1 s on `onclose` unless the effect was torn down. `onmessage` appends `type: "message"` events and updates presence counts. A frame is just text: nothing in the browser proves it is a valid event.

### Boundary 3 — the server guards the event shape

`connectSocket` (`server/src/index.ts:108`) first resolves the room from the query string and closes with `4404` for an unknown slug. On every frame it `JSON.parse`s and returns silently on failure, checks `type === "message"` and that `author` and `body` are strings, then enforces `author.length <= 40` and `body.length <= 2000` (line 140) before trimming. The `WebSocketServer` itself has `maxPayload: 16384` (line 95): a bigger frame closes that socket with 1009 before any handler runs. Malformed input is dropped, never answered, which is why the tests assert on what happens *after* the bad frames.

### Boundary 4 — the handler writes the row and nothing else

The only side effect of a valid frame is `INSERT INTO messages (room_id, author, body)` through `query` (line 150). The comment there is the lesson: the handler does not broadcast. If the insert throws, the socket is closed with 1011 `Message could not be saved` and nothing was delivered, so a client can retry from a known state.

### Boundary 5 — the database commits and notifies

`messages_notify` (`server/db/schema.sql`) runs `AFTER INSERT` and calls `pg_notify('chat', json_build_object(...))`. The notification is delivered on commit to every connection that ran `LISTEN chat`, including a second server instance or a `psql` session. The dedicated listener client in `startListener` (line 204) receives it on the `notification` event; a pooled client would not.

### Boundary 6 — the broadcast is the response

`broadcast(roomId, event)` (line 183) serializes once and sends to every open socket in `roomClients.get(roomId)`. That includes the sender, which is how the composer learns its message was stored. The second test waits for that broadcast (a real event, not a `setTimeout`), then re-reads `/api/rooms/study/messages` over HTTP and asserts the ids match: the socket event and the row are the same fact seen two ways.

## Predict the regression scenarios

| Scenario from the executable suite | Prediction to write before running |
|---|---|
| room names reject malformed values and duplicate slugs | Initial records, request/input, expected result, and records that must remain unchanged. |
| malformed socket events do not crash; valid message persists and broadcasts | Initial records, request/input, expected result, and records that must remain unchanged. |

Open the test file and identify the arrange, act and assert portions. Arrange creates the synthetic starting state. Act calls the real boundary. Assert reads the observable result. Some tests repeat a call or issue two calls together; explain why a single ordinary call would miss that defect. Tests may share a deliberate fixture within one suite, so read setup and earlier scenario state before copying one case into a standalone script.

## A successful request, described precisely

Start with a valid fixture from the test. Copy the values into your own learning notes rather than copying a personal record. State which fields are required, which may be omitted and which have a special meaning when empty. Execute the operation once. Compare the response with a fresh authoritative read, then compare the UI with that read. If the UI is still loading, wait for the actual expected condition instead of guessing a fixed delay.

Record the stable ID and one changed field. Record at least one field that must remain the same. If the operation creates a child, record the parent ID stored on the child. If it updates an aggregate, compute the expected aggregate by hand. If it restores a backup, count retained, ignored and recreated records according to this project’s documented policy. These observations make a small example reusable when the implementation changes.

## A rejected request, described precisely

Now change one value to a rejected case named in the test suite. Keep everything else identical. Predict where validation fails. Run it and capture both the feedback and the authoritative state afterward. Compare the saved record, related rows and relevant counters with their pre-request values. A controlled error is useful only if the application also preserves the intended state.

Do not assume that all failures have the same status or message. Invalid input, missing records, conflicts and infrastructure errors represent different conditions. Read this app’s handler or parser to see the actual result. Browser-only parsers return a success/error union or throw an import error rather than returning an HTTP status. Translate the same correctness idea into the contract this app actually exposes.

## Read the storage boundary

Read [test/database.ts](../test/database.ts). PostgreSQL owns persistent rows; a unique search_path isolates each test schema. Failure triggers are created only inside that schema. If a process is interrupted, inspect its exact schema name before cleanup. The course never requires personal application data.

Place a breakpoint immediately before the first write and another after the final write or publish step. On the success path, note what changed between those points. On the rejected-input path, the first write should never be reached when validation promises pre-write rejection. On a transactional failure path, some statements may execute and then roll back; reaching a write statement does not mean its effect committed.

An await marks a place where another operation can run. It does not itself define a transaction. When the test uses Promise.all, sketch request A and request B in two columns. Show where each acquires a lock or reads state. The test should accept either winner while insisting on the same final invariant. For synchronous or browser-only validation, explain why concurrency is outside the tested function rather than borrowing a database explanation that does not apply.

## Explain the design tradeoff

A WebSocket remains open across many messages. One bad JSON message should not kill the process or prevent the next valid message. Parsing JSON checks syntax; checking type, author and body checks the protocol shape. A maximum frame payload bounds memory use independently from field-length validation.

The write path inserts into PostgreSQL. A database trigger produces a notification, the dedicated LISTEN connection receives it, and the process broadcasts to sockets in that room. This is a different path from returning an HTTP response. The integration test waits for a real message broadcast and then reads HTTP history to confirm persistence.

Starting listeners at module import makes tests unexpectedly bind ports and retain database connections. Explicit lifecycle functions put those side effects under caller control. stopRuntime terminates sockets, closes the server and listener, and clears a scheduled retry. The current reconnection attempt is bounded teaching behavior, not a durable delivery guarantee: disconnected clients recover recent history, not an acknowledged message queue. Author names remain free-form demo labels, not authenticated users.

## Change one requirement independently

**Practice task:** Show a sending/error state for a message draft.

Before implementation, write three acceptance criteria: an ordinary successful case, a rejected or cancelled case, and a case that preserves existing behavior. Identify the smallest file boundary that owns the rule. Keep the existing regression suite; add a test only when it observes a new promise. Do not reproduce the implementation line by line inside the assertion, because both copies can contain the same mistake.

After a first attempt, compare your design with this hint: Introduce a client message ID and an acknowledgement protocol; retain the draft until accepted. Do not infer durable storage merely from socket.send returning.

## Debug a disagreement between layers

If the form and response disagree, inspect the request payload before editing the database code. If the response and database disagree, inspect the mapper, transaction and read query. If a test fails before an HTTP request is logged, inspect startup, environment variables and the test fixture. Missing dependencies, a busy port or an unavailable database are different from a failed business assertion. Preserve the first useful error and fix that cause before interpreting later cascading failures.

When a date looks wrong, distinguish a calendar label from an instant and check the serialization boundary. When an optional field will not clear, distinguish omission from an explicit empty/null value. When a list seems to lose a record, inspect filtering, sorting and pagination before assuming deletion. When history duplicates, compare desired-state commands with commands that represent a new event. These are diagnostic questions to apply to the actual fields above.

## Final independent checkpoint

Close this guide and give a five-minute walkthrough using only the application source and one test. Explain the user-visible problem, the input contract, the identity model, the write boundary, a failed operation and the remaining limitation. Then modify the worked fixture and predict the result without running it. Reopen the guide only after writing your answer.

A useful review note includes the exact command run, its result, and the boundary it covers. Keep browser interaction, simulated storage tests, real HTTP/database tests and compile checks distinct. The [verification page](VERIFICATION.md) records this delivery’s evidence. Exercises and proposed extensions in this course remain learner work; they are not counted as implemented features.
