# Concepts explained from first principles

[Course index](README.md)

## The central idea: recursive queries, structural invariants and concurrent tree moves

Consider two roots A and B. Request one proposes A under B; request two proposes B under A. Both are valid against the initial tree. Checking first and updating later leaves a time-of-check/time-of-use gap. The transaction takes a SHARE ROW EXCLUSIVE table lock before validating the structure. The second writer waits, then sees the first committed move and rejects the cycle. A transaction alone at the default isolation level would not make two independent read-then-write checks safe.

The lock is deliberately broad: it serializes structural writers for this small teaching app. It is easy to explain and inspect, but reduces concurrent write throughput. A more scalable design requires a proven locking or serializable-retry strategy, not simply removing the lock. The API policy cannot prevent arbitrary direct SQL from creating a cycle if that SQL bypasses the validation. The recursive query and the lock solve different parts of the problem: reachability and concurrency.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Moves validate UUIDs and parent existence, lock structural changes within a transaction, check the subtree under the lock, then update. A node cannot become its own ancestor.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Each node has a UUID, name, title and nullable parent_id. A null parent means a root. Children point upward; recursive SQL discovers descendants. A valid forest may have several roots, but every parent chain must terminate.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Bounding the wait for the lock

`LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE` serializes every structural move behind one lock. That is the point, and it has a cost: a move issued while another move is in flight *waits*, and with a slow or stuck writer it would wait forever. The route now runs `SET LOCAL lock_timeout = '3s'` right after `BEGIN`: PostgreSQL abandons the lock attempt after three seconds with SQLSTATE `55P03` (`lock_not_available`), the transaction rolls back, and the error middleware answers 503 with `Retry-After: 3`. Predict the two outcomes of the concurrency test in this course under that rule (both moves complete within three seconds, so both are 200/400 as before), then reproduce the timeout: in `psql`, `BEGIN; LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE;` and leave it open, then call the move route.

**Status codes for a bad parent.** The route answers 404 only when the node being moved does not exist. A `newParentId` that is not a UUID, or a UUID that names no node, is a 400 (`Choose a valid parent id or null for a root.` / `Parent does not exist.`): the *reference* is malformed from this node's point of view. Moving under yourself or a descendant is also 400. The test at `test/feature.test.ts:14` pins the 400 cases.

