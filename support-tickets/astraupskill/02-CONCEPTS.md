# Concepts explained from first principles

[Course index](README.md)

## The central idea: row locks, atomic updates and meaningful audit events

An audit event should describe a transition, not merely a button click. With status Open, requesting Resolved twice should produce one Open-to-Resolved event. Both requests must compare against the current locked row. Otherwise two concurrent callers can each read Open and both log the same transition. SELECT FOR UPDATE makes the second caller wait and inspect the committed value.

The same idea applies to assignment, including assigning the same agent twice. The update and corresponding event belong in the same transaction and use the same database client. Throwing after one successful query does not undo that query unless it is inside a transaction that rolls back. Foreign keys protect references, but a malformed UUID should be rejected before it becomes an opaque database error. This is repeat-safe current-state handling, not global request deduplication: if another valid transition happens between two commands, the later command may create a new event.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Status and assignment read the current ticket under a row lock, return it unchanged for a repeated value, and record actual changes transactionally. Input and UUID validation reject malformed requests; failed related writes roll back.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

`parseTicket` (`server/src/index.ts:269`) validates the shape (subject, body, priority from `asEnum`, an optional agent id, label ids) and normalizes text before anything touches the database. The interesting normalization is the label set: a `PUT` replaces the whole set. `ticket_labels` is a junction table (one row per ticket-label pair), so "replace" is `DELETE FROM ticket_labels WHERE ticket_id = $1` followed by one `INSERT` per label (`linkLabels`, line 247) inside the same transaction. Sending `labelIds: []` therefore means "no labels", not "leave them alone": there is no partial update of the set. Predict what a client that omits `labelIds` gets (validation rejects it; the field is required by `parseTicket`), then check.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Three identities meet in one ticket: the ticket id (a UUID minted by PostgreSQL), the agent id in `assignee_id` (a foreign key, nullable: `null` means unassigned and is a real state, not a missing value), and the label ids in the junction table. The API returns labels as objects resolved from those ids, so the client never stores label names. Status history (`ticket_events`) is derived data written by `logEvent` at the moment of change; you cannot reconstruct it from the ticket row, which is why it is written in the same transaction as the change and why a no-op status command writes nothing.

## Small design decisions deserve explanations

Why `DELETE` + `INSERT` for labels rather than a diff? Because the set is small (a handful of labels), the operation is inside a transaction, and a diff needs the current rows first, which is another round trip and another race to reason about. Why is a repeated `PATCH /status` with the same status a no-op (line 176: `SELECT status ... FOR UPDATE`, compare, return)? Because history must record changes, not clicks. Why is the event logged after the update in the same transaction? So a failed audit insert rolls the status back (the fourth test proves it). Each of these is a decision a reviewer will ask about; be ready to defend them.

