# Concepts explained from first principles

[Course index](README.md)

## The central idea: HTTP boundaries, WebSocket messages and database notifications

A WebSocket remains open across many messages. One bad JSON message should not kill the process or prevent the next valid message. Parsing JSON checks syntax; checking type, author and body checks the protocol shape. A maximum frame payload bounds memory use independently from field-length validation.

The write path inserts into PostgreSQL. A database trigger produces a notification, the dedicated LISTEN connection receives it, and the process broadcasts to sockets in that room. This is a different path from returning an HTTP response. The integration test waits for a real message broadcast and then reads HTTP history to confirm persistence.

Starting listeners at module import makes tests unexpectedly bind ports and retain database connections. Explicit lifecycle functions put those side effects under caller control. stopRuntime terminates sockets, closes the server and listener, and clears a scheduled retry. The current reconnection attempt is bounded teaching behavior, not a durable delivery guarantee: disconnected clients recover recent history, not an acknowledged message queue. Author names remain free-form demo labels, not authenticated users.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Room fields and socket messages are validated. Runtime start/stop functions enable isolated tests; malformed messages are ignored, database failures close the affected socket, and the payload size is bounded.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Rooms have id, slug and name. Messages have id, roomId, author, body and createdAt. WebSockets subscribe to room IDs, while PostgreSQL LISTEN/NOTIFY delivers committed message notifications to the process.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## LISTEN/NOTIFY: how a row insert becomes a broadcast

The server never pushes a chat message to sockets directly. It inserts a row, and PostgreSQL tells it, and every other server instance, that the row exists. The mechanism is a trigger in `server/db/schema.sql`:

```sql
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('chat', json_build_object(
    'id', NEW.id,
    'roomId', NEW.room_id,
    'author', NEW.author,
    'body', NEW.body,
    'createdAt', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_notify
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_new_message();
```

Three facts to hold onto before you read `startListener` in `server/src/index.ts`:

1. **`pg_notify` fires on commit, not on execution.** If the transaction that inserted the message rolled back, no notification is sent. That is why the broadcast is a reliable signal that the row is durable.
2. **The listener needs its own, non-pooled client.** `createListenerClient()` opens a dedicated `pg.Client` and runs `LISTEN chat`. A pooled connection would be returned to the pool and the `LISTEN` would silently stop applying. The `error` handler ends the client and schedules `startListener()` again after 1 s.
3. **A disconnected listener loses notifications, not rows.** Notifications are not queued for a client that is not connected. That is the whole reason the browser re-reads history over HTTP (`GET /api/rooms/:slug/messages`) when it reconnects, and why exercise 4 (acknowledged delivery and replay) is a design problem rather than a bug fix.

Predict, then check with `psql` on your dev database: run `INSERT INTO messages (room_id, author, body) SELECT id, 'psql', 'hello from sql' FROM rooms WHERE slug = 'general'` while the app is open on the General room. The message appears in the browser without the Node server having received any WebSocket frame.

