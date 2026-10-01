# Concepts explained from first principles

[Course index](README.md)

## The central idea: optional values and stable chronological sorting

Empty and invalid are different. Leaving a follow-up unscheduled is intentional; February 30 is malformed. Preserve the empty-string convention while rejecting invalid nonempty labels.

Undated applications should not acquire invented urgency. The comparison places their sentinel after valid dates, then uses id for stable ties. Sorting the filtered copy preserves the underlying collection. This is chronological display ordering, not a reminder service: it sends no notifications and changes no workflow stages automatically. A rejected edit must leave the saved application intact.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Text fields are bounded and typed. Nonempty next-step dates must be real dates. Filtered results sort by date, place undated applications last, and use ids for ties.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Applications contain id, company, role, stage, contact, nextStepDate and notes. Empty nextStepDate means unscheduled. Stage and search filter an in-memory collection.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Why a fake date sorts last

`GET /api/applications` sorts with `(a.nextStepDate || "9999-99-99").localeCompare(b.nextStepDate || "9999-99-99") || a.id.localeCompare(b.id)` (`server/server.js:35`). Two facts make that correct: `YYYY-MM-DD` is fixed-width and zero-padded, so comparing the strings character by character is the same as comparing the dates; and `"9999-99-99"` is greater than every real date in that comparison, so undated applications sort last. It is a sentinel, not a date: never store it, never parse it, and never copy the trick to a format that is not fixed-width (`3/9/2026` vs `12/1/2026` would sort wrong). The honest alternatives are a comparator that returns `+1` when only `a` is undated, or in SQL `ORDER BY next_step_date NULLS LAST, id`.

