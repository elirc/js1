# Concepts explained from first principles

[Course index](README.md)

## The central idea: identity in dynamic arrays and commit-before-publish

An index describes position, not identity. If A, B and C have 4, 7 and 2 votes, deleting A moves B from index 1 to 0. Matching by position can now attach the wrong votes. Matching by id finds the same option wherever it appears. A new option receives a fresh id, so it cannot inherit removed votes. Renaming an existing option preserves its votes; the app treats that as a label correction, not a new election choice.

Validation precedes candidate construction. Trimming labels is normalization; rejecting equal case-folded labels is validation. A storage quota failure leaves the saved poll and current draft available for retry. The candidate does not become authoritative until setItem succeeds. This is a local poll builder, not a secure voting system.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Draft options carry stable ids. Surviving options retain their votes; new options start at zero. Blank or duplicate labels are rejected. Save, vote, reset and delete publish state only after storage succeeds.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

A poll has id, question and options. An option has its own id, text and votes. Drafts contain id/text; they become the saved poll only at commit. Data lives under js1-poll-studio in localStorage.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.

## Two layers, one rule

`handleSubmit` in `app.js` rejects a question longer than 160 characters. The `<input id="poll-question" maxlength="160">` in `index.html` now says the same thing to the browser, so a user cannot type past the limit and the JavaScript check only fires for pasted or scripted input. Before the fix pass the input said 120 while the code said 160: two layers, two rules, and a confusing experience where the browser stopped you 40 characters early. Keep the two numbers together (or derive one from the other) whenever you add a bound.

