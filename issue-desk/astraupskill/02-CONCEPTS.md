# Concepts explained from first principles

[Course index](README.md)

## The central idea: independent filter dimensions and runtime validation

A High issue can be Backlog or Done. Filtering High and Backlog requires both predicates, plus the text predicate when supplied. OR would return unrelated records. Keep these dimensions separate rather than encoding one into another.

The client sends state via URLSearchParams; the API checks the vocabulary. A select helps ordinary users choose but cannot validate direct API requests. Bounded text checks precede trimming in repository methods. Use a small fixture matrix to prove composition rather than relying on a large seed list whose results are hard to predict.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Priority filtering composes with status and search in UI and API. Invalid priorities and malformed text return useful errors; updates preserve issue identity.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

An issue has id, title, status, priority, assignee, description and createdAt. Status is workflow position; priority is urgency. Filtered results derive from in-memory records.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Why the array forgets, and what SQL would change

`createIssueRepository()` (`server/server.js:84`) keeps `issues` in a closure. Every request mutates that array synchronously, so within one process there is no interleaving and no need for a transaction. Two things follow. First, a restart reseeds: nothing you created survives, which is fine for a lesson and wrong for a product. Second, the filter in `list()` scans every issue and lower-cases the title, description and assignee on every request; with SQL that becomes `WHERE (status = $1 OR $1 = 'all') AND (priority = $2 OR $2 = 'all') AND (title ILIKE $3 OR ...)`, the case handling moves into the database, and the `priority` vocabulary check moves from `validateIssue` into a `CHECK` constraint or an enum type. What does *not* change is the shape of the guard: validate the query before you touch storage, and answer 400 for a vocabulary you do not know (the first test's `priority=Unknown`).

