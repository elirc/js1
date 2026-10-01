# Concepts explained from first principles

[Course index](README.md)

## The central idea: filter-sort-slice order and numeric boundaries

Filter, then sort, then slice. Slicing first produces sparse pages and misleading totals. Equal prices still need a unique tie-breaker to make boundaries deterministic.

Requested and returned pages can differ after deletion. The server knows the filtered total and clamps to its last real page; the client should display that metadata. Infinity is not a valid price just because it is >= 0. Checking finite values, whole stock counts and accepted text representations prevents conversions from hiding malformed input. Pagination does not add persistence or concurrency guarantees to an in-memory store.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Paging normalizes to bounded whole values. Sort ties use ids. Names/categories are bounded text, prices are finite and bounded, and stock is a nonnegative whole count. Existing last-page clamping has regression coverage.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Products have id, name, category, price and stock. The API returns items and page metadata. The client holds one page; the repository itself remains in memory.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Rejecting versus clamping a page size

`const pageSize = whole(req.query.pageSize,1,1000000) ? Math.min(Number(req.query.pageSize),50) : 5;` does two different things in one line. A value that is not a whole number in 1..1000000 (`0`, `2.5`, `abc`) is *replaced* by the default 5: that is rejection with a fallback. A valid value above 50 is *clamped* to 50. Both are defensible, but a reader cannot tell which happened from the response unless `pageSize` is echoed back, which it is. Predict, then check with the new test: `?pageSize=500` -> 50, `?pageSize=0` -> 5, `?pageSize=2.5` -> 5. If you would rather answer 400 for a bad page size, that is exercise material; either way, say it in the API docs.

