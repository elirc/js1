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
