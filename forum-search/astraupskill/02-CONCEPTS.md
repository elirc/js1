# Concepts explained from first principles

[Course index](README.md)

## The central idea: count/page consistency, stable ordering and bounded input

Suppose six matching threads use a five-row page. Page two has one item. Deleting it leaves five matches, so page two no longer exists. Clamp the requested page after counting, then calculate offset from the clamped value. With zero matches, retain a usable first-page representation rather than negative offsets. Stable sorting adds a unique id after the primary sort key so tied values have a deterministic order.

A REPEATABLE READ transaction makes the count and row query see the same snapshot within one request. It does not freeze results across later page requests: another user can insert or delete between clicks. The browser also has a separate responsibility when multiple searches race. This change does not add a stale-response guard; a request sequence counter or AbortController is a useful independent extension. Database consistency and latest-user-intent rendering address different boundaries.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Search count and rows share a read-only repeatable-read transaction. Page numbers clamp to the available range, ordering has an id tie-breaker, and thread/tag inputs and author references are validated.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Threads belong to authors and can carry tags. A filtered result consists of items, total, page and page count; these values describe one database snapshot for that request. They are not independent facts to calculate with unrelated filters.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

The list route (`server/src/index.ts:34`) runs `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` before the `COUNT(*)` and the page `SELECT`. What that buys: both statements see the same snapshot, so `total` and `items` can never disagree even if another request inserts a thread between them. What it does not buy: it is not a lock. A concurrent insert is invisible to *this* request and visible to the *next* one; a page fetched a second later may contain a row the first fetch did not know about, which is why "same query twice returns the same ids" in the first test only holds when nothing was inserted in between. The new third test shows the other consequence: deleting the only row on page 2 and re-reading page 2 clamps to page 1, because the clamp is computed from the count inside the same snapshot as the rows.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
