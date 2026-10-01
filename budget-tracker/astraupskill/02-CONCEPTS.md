# Concepts explained from first principles

[Course index](README.md)

## The central idea: numeric parsing, representations and persisted state

Number inputs supply text. Define its grammar before conversion: Number accepts forms that do not belong in this currency workflow. Split whole and fractional text, right-pad the fraction and construct integer minor units. Do not multiply arbitrary fractional input and assume an exact result. Existing saved dollars remain compatible; each total contribution is rounded to cents first. This is not a versioned migration or arbitrary-precision ledger. Extremely large collections can exceed safe aggregate limits, and legacy malformed storage is not automatically repaired. Committing state is a separate boundary: serialize the full candidate, write it, then publish it. Stable ids distinguish an edit from accidental insertion.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> New amounts require positive bounded decimal text with at most two fractional digits and real dates. Totals accumulate cents. Create, edit and delete publish only after storage succeeds, retaining the form on failure.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Stored amounts retain the original dollar-number format. New input is parsed into bounded cents, and totals accumulate rounded cents before dollar formatting.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Why zero is rejected everywhere, including on an edit

`parseCents` ends with `cents > 0` (`app.js:198`), so `"0"` is not money. For *creating* a
transaction that is clearly right: a zero-value income or expense is not a fact about your
finances, it is a mistake or an empty form, and accepting it produces rows that clutter a ledger
and mean nothing.

The consequence is less obvious. `saveTransaction` (`app.js:85`) uses the same parser for an
edit, so a record whose stored `amount` is `0` - which only legacy data or a hand edit can
produce, since the current build cannot create one - **can never be saved again**. Open it in the
editor, change its description, press Save, and you get the message about a positive amount. The
record is readable and deletable, but not editable.

That is a real rough edge, and the honest thing is to name it rather than pretend the rule is
free. Three defensible positions:

1. **Keep it (what the code does).** One rule, one parser, one place to change it. A zero record
   cannot exist by the current rules, so being unable to re-save one is a consequence of the
   data being invalid, not of the editor being broken. The user can delete it.
2. **Allow zero on edit only.** `parseCents(text, { allowZero: editingId !== null })`. Now the
   validity of a value depends on *how you arrived at the form*, which is the kind of rule that
   is correct for six months and then surprises everybody - including the next developer who
   reuses `parseCents` somewhere a third way.
3. **Fix it at the boundary instead.** Treat a zero-amount record as invalid data on load, the
   same way `normalizeAmounts` (`app.js:71-83`) treats an over-precise one: quarantine it, or
   snap it to something, or refuse to display it. This keeps one rule for input *and* makes the
   impossible state impossible, which is usually the better trade.

The delivered code takes position 1, and
[test/money.test.cjs](../test/money.test.cjs) now pins it with a test so that changing it has to
be a decision rather than an accident. Write down which you would have chosen and what it costs.
The point of this section is not the answer; it is that "what does this rule do to data that
already exists?" is a question you must ask every time you tighten a validator.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
