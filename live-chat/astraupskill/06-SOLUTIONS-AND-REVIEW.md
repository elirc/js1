# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Room fields and socket messages are validated. Runtime start/stop functions enable isolated tests; malformed messages are ignored, database failures close the affected socket, and the payload size is bounded.

The key model is: Rooms have id, slug and name. Messages have id, roomId, author, body and createdAt. WebSockets subscribe to room IDs, while PostgreSQL LISTEN/NOTIFY delivers committed message notifications to the process.

The worked fixture should behave as follows: Connect to study, wait for presence, send malformed JSON, null, and an object-valued author, then send Trace this insert. The valid message broadcasts and appears once in HTTP history. Creating study twice returns 409.

## Extension solutions

### Exercise 1

**Prompt:** Show a sending/error state for a message draft.

**Approach:** Introduce a client message ID and an acknowledgement protocol; retain the draft until accepted. Do not infer durable storage merely from socket.send returning.

**Review:** the draft must be marked sending when `socket.send` is called and cleared only when the broadcast with the same body arrives; a socket that is not `OPEN` must show an error state instead of silently dropping the draft (`send` currently returns early); your test must simulate a closed socket and assert the draft is still there.

### Exercise 2

**Prompt:** Add a room rename endpoint without changing the room ID or slug.

**Approach:** Validate the new display name and update only that field; existing messages retain their room foreign key.

**Review:** the endpoint must be `PATCH /api/rooms/:slug` changing only `name`, validated like `createRoom`; the `id` and `slug` must be provably unchanged (compare the row before and after), open sockets must keep working because `roomClients` is keyed by `id`, and a rename to the same name should be a no-op that still returns 200.

### Exercise 3

**Prompt:** Test two rooms to ensure broadcasts do not cross subscriptions.

**Approach:** Open a socket in each room, send one message and assert only the matching room receives it. Close both sockets in finally.

**Review:** open two sockets on two rooms, send in one, and assert the other receives nothing within a bounded wait (use a `setTimeout` race that resolves to `"no message"`), then assert the first did receive it; explain why the guarantee comes from `roomClients` being keyed by the room id in the notification payload, not from the socket that sent the frame.

### Exercise 4

**Prompt:** Design acknowledged delivery and reconnect replay.

**Approach:** Use persistent message IDs and a replay cursor. Explain duplicates, ordering and acknowledgement loss before claiming exactly-once delivery.

**Review:** your design must state what the server stores per client (last acknowledged message id), how reconnect asks for `?after=<id>`, why replay reads rows over HTTP or SQL rather than replaying notifications (they are not queued), and what happens to a message whose insert committed but whose broadcast was lost while the listener was reconnecting.

### Exercise 7 — ownership and authorization

Reference (the identity comes from the connection, so the frame cannot lie):

```typescript
const sessions = new Map<string, { name: string }>();
app.post("/api/sessions", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2 || name.length > 40) return res.status(400).json({ error: "Name must be 2-40 characters." });
  const token = crypto.randomUUID();
  sessions.set(token, { name });
  res.status(201).json({ token, name });
});
// connectSocket, before join():
const session = sessions.get(url.searchParams.get("token") ?? "");
if (!session) { socket.close(4401, "Sign in first"); return; }
// message handler: const author = session.name; (event.author is ignored)
```

Reference test skeleton: open a socket with a valid token, send `{ type: "message", author: "Impostor", body: "hi" }`, await the broadcast and assert `message.author` equals the session name; open a socket without a token and assert the close code is 4401 and `count(*)` on `messages` is unchanged.

Review: explain why moving `author` from the payload to the connection is authorization and not validation, why the close code is 4401 (application range) rather than 1008, and what a real app would replace the in-memory `sessions` map with.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/chat.test.ts](../test/chat.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Malformed socket events could call trim on nonstrings; listener startup occurred during import and asynchronous failures could escape their handlers. I changed the implementation so that: Room fields and socket messages are validated. Runtime start/stop functions enable isolated tests; malformed messages are ignored, database failures close the affected socket, and the payload size is bounded. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
