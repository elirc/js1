# Concepts explained from first principles

[Course index](README.md)

## The central idea: repeat-safe workflow history and explicit input contracts

Follow one concrete command: change "Inspect west-wing ventilation" from Open to Scheduled. The first successful command represents a real transition and adds one status event. Sending Scheduled again compares equal to current state, so it returns the record without adding another status event. Created, updated and note entries remain separate kinds; counting every timeline row would give the wrong assertion. This guarantee concerns repeated current values, not global request deduplication. After an intervening transition, requesting Scheduled can legitimately create a new event.

The repository owns the live array. Its status method checks existence, compares the current value, then changes the record and appends history synchronously. There is no await between those operations. This makes the repeat-safe behavior easy to trace inside one Node process, but it is not a durable database transaction or a multi-process coordination strategy. A server restart discards new records and history. The API tests use a fresh process fixture and real HTTP, so they check routing and validation as well as repository behavior.

Validation belongs at the API boundary even when the React controls constrain input. An object is not a valid title, an unknown priority is not silently accepted, and 2027-02-29 is not a real date. Normalization may trim a valid string, but should not stringify an object into a misleading title. For paging, count matching rows before clamping a request such as page 999. Sort by the selected field and then id so ties are deterministic on an unchanged dataset. The scaffold accepts its named statuses; it does not enforce a domain approval graph or actor permissions. A Open-to-Scheduled label change alone does not implement every real-world rule for a maintenance work order and its responsible technician.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Actual changes update the in-memory record and append one status event. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

This app represents a maintenance work order and its responsible technician. A record uses generic fields id, title, owner, category, status, priority, amount, dueDate and notes. Categories are HVAC, Electrical, Network, Safety. Statuses are Open, Scheduled, In Progress, Completed. The UI gives these shared fields domain-specific labels. Maintenance due date is represented as a YYYY-MM-DD calendar string, not an instant. A repository array and its activity collection live only in the Node process. Restarting the server restores seeds; this change does not add durable storage.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## The survivor of a five-way clone family: what the array really costs

This course is the one to do among five near-identical projects (library-lending, gym-membership, campaign-planner and volunteer-coordinator carry a banner pointing here). The differentiating lesson is the storage boundary. `createRepository()` (`server/server.js:90`) keeps `items` and `activity` in a closure: `setStatus` compares, builds the new record and the activity entry, then replaces the array and unshifts the entry, synchronously. Three consequences:

1. **Restart loses everything.** The seed runs at module load; there is no file, no database. A product needs durable storage; a lesson needs a predictable start.
2. **Atomicity is free, once.** Within one process no request can observe the record changed but the history missing, because there is no `await` between the two writes. Add a second process, or an `await` (a disk write, a network call) between them, and that guarantee evaporates.
3. **Idempotence is a comparison.** The no-op guard is `if (existing.status === status) return existing;`. In SQL it becomes `UPDATE ... WHERE id = $1 AND status <> $2` (zero rows means no-op) or a `SELECT ... FOR UPDATE` followed by the same comparison, which is exactly what the Postgres siblings in this batch do (`subscription-billing`, `asset-checkout`).

What would have to change to move this to SQL: the repository's six functions become six queries; `query()` becomes one `COUNT(*)` plus one page `SELECT` under the same snapshot; `setStatus` becomes a transaction with a row lock; and the tests keep their shape (they already talk HTTP, not arrays).

