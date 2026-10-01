# Concepts explained from first principles

[Course index](README.md)

## The central idea: calendar buckets, window functions and derived data

SQL GROUP BY only produces groups present in the input. If Monday has 10 purchases and Wednesday has 20, Tuesday does not exist in the grouped result. generate_series supplies the calendar spine. LEFT JOIN keeps Tuesday, and COALESCE converts the missing aggregate to zero. Only then does a ROWS window correspond to calendar days. The order of these operations is part of correctness.

The first moving-average points use the available rows inside the requested window; the first point is a one-day average, not a hidden seven-day warm-up. Cumulative totals also reset at the requested window boundary, and the first delta is null because there is no preceding row in that result. Summary and series share inclusive calendar-day boundaries. The separate top-products query retains a rolling timestamp window. Refreshing a materialized view is an explicit update to a stored derived result; newly inserted raw events can exist before that view reflects them.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> The series generates every requested calendar day, left-joins daily aggregates, fills missing values with zero and computes the moving average and cumulative total over those rows. Summary uses the same inclusive day window.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Raw events are timestamped facts with event type, product and purchase amount. Daily aggregates and materialized views are derived data. The chart returns one row per calendar date; a missing event row becomes a zero-valued day rather than disappearing.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Freshness and the refresh lock

`daily_metrics` is a materialized view: reads are cheap because the aggregation happened at the last `REFRESH`, and `GET /api/metrics/freshness` reports how far raw `events` have moved since then. `REFRESH MATERIALIZED VIEW CONCURRENTLY` lets readers keep reading while the view is rebuilt, but two refreshes cannot run at once: the second waits for the first's lock. The route now runs the refresh in a transaction with `SET LOCAL lock_timeout = '2s'`; if the lock is not available in time PostgreSQL raises `55P03` and the route answers 409 rather than holding the request open. Predict what a dashboard should do with a 409 (show the last refresh time and retry), then reproduce it: start a long refresh in `psql` inside a transaction and call the route.

