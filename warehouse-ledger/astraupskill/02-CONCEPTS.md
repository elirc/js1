# Concepts explained from first principles

[Course index](README.md)

## The central idea: protecting a balance under concurrent writes

An append-only ledger represents corrections with new entries. Receiving 10 adds +10; issuing 3 adds -3; the balance is 7. A transfer adds -q at the source and +q at the destination, so total stock across warehouses is conserved. Deleting a movement to correct a mistake would erase the explanation of how stock arrived at its current value.

A transaction makes multiple writes all-or-nothing, but a transaction alone does not prevent two readers from approving the same stock. This app locks a product row before computing balances. All movement and transfer writers use that same lock. One product lock serializes its warehouses, trading some concurrency for an understandable rule and avoiding inconsistent lock order between opposite transfers. Direct SQL writers that ignore this protocol are outside the application guarantee.

Number.isInteger checks the quantity rather than truncating it. A request for 1.7 units must not quietly become one unit. The bound matches the SQL integer column. The product lock is taken even for receipts so all writers participate in one ordering. Warehouse existence is checked before inserts; SQL foreign keys still protect stored references.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Movement and transfer payloads require valid UUIDs, bounded whole quantities and text reasons. Every write locks the product before reading balances. Transfers remain two atomic ledger entries.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Products and warehouses have UUIDs. A movement references one of each and carries signed integer delta, reason and creation time. Stock is SUM(delta) per product/warehouse; there is no separately stored balance to synchronize.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
