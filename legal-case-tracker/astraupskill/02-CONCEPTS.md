# Concepts explained from first principles

[Course index](README.md)

## The central idea: runtime validation, stable pagination and repeat-safe status history

A status command expresses a desired value. If a legal case tracker record is already Discovery, setting it to Discovery again is not another business event. Compare the current value before writing. This makes retries easier to reason about, but it does not mean every create request is idempotent: repeating POST can still create a second record.

A date such as 2028-02-29 is a calendar label. Validate its shape and compare its parsed calendar components; 2027-02-29 has the right shape but is not a real day. Activity timestamps are instants and have different semantics. Amounts must be finite, nonnegative numbers: `server/server.js` checks `Number.isFinite(input.amount) && input.amount >= 0` and nothing else, so a value such as 12.505 is stored exactly as sent. Rounding or rejecting fractional cents is a proposed exercise in chapter 5, not implemented behavior. This scaffold does not perform external billing or legal casework.

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. Synchronous array operations cannot interleave midway through an await because there is no await in that boundary. This explanation is specific to one process. Adding disk I/O or multiple API instances requires a new coordination design.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. The synchronous in-memory repository changes a record and appends history together within one process.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

The main record represents a case owner, case category, due date and amount. Shared fields include id, title, owner, category, status, priority, amount, dueDate and notes. Statuses are Intake, Discovery, Negotiation, Closed. Categories are Contract, Employment, Real Estate, Compliance. Activities reference the record ID. Records and activities live in JavaScript arrays and reset when the API process restarts.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
