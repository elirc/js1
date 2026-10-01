# Concepts explained from first principles

[Course index](README.md)

## The central idea: immutable movement, ordering invariants and keyboard access

A move changes both membership and sibling order. Moving A out of [A,B] should leave B at order 0. Inserting A before C elsewhere should yield A=0 and C=1. Cloning first makes the intended result reviewable without mutating the current board.

A re-render replaces DOM elements, so focus can disappear even when a keyboard button works. Restoring focus to the moved card lets the user continue without returning to the top. The select expresses destination; up/down expresses order. Both paths call the same move function so keyboard and drag behavior cannot drift apart. Other legacy CRUD paths are outside the failed-move guarantee.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Moves validate targets, ignore self-drops, calculate a candidate and renumber every column before saving. Failed moves preserve state. Column selects and move-up/down buttons support keyboard use and restore focus.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Each card has id, title, column and order. Column is todo/doing/done; order is a zero-based position within that column. The browser stores the card array under js1-kanban-flow.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Feedback for operations that changed nothing

`moveCard` now compares the renumbered `candidate` with `state.cards` before writing. If nothing changed (a card dropped onto its own position), it says `Card is already there.` and returns without touching `localStorage`. Two reasons: a message that says "moved" when nothing moved trains users to distrust messages, and a no-op write is still a write that can fail (quota) and can overwrite another tab's newer state. The same idea appears on the server courses as the idempotency guard in a status handler.

