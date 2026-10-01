# Concepts explained from first principles

[Course index](README.md)

## The central idea: half-open intervals, database constraints and timezones

Half-open intervals include their start and exclude their end, so adjacent meetings can share a boundary. A check-then-insert in application code has a race; the database constraint is the final arbiter. A failed UPDATE preserves the previous row. datetime-local has no timezone, so the browser converts it to an ISO instant before submission. A local day is represented by two independently computed midnights, which can be 23 or 25 hours apart. The explicit legacy UTC-day policy avoids depending on a database session timezone. bookedBy is a human label, not authentication: this demo does not enforce ownership. Runtime validation gives helpful errors, while the constraint protects integrity even for competing writes. An overlap test and a failed-update test prove different postconditions.

## A browser dependency the change relies on, and how it is contained

`client/src/App.tsx:127,131` render the two time fields as
`<input type="datetime-local" step="0.001">`. That `step` is what asks the browser for
**millisecond** precision, and it is a genuine dependency on the browser, not on your code.

The HTML specification allows an implementation to normalise a `datetime-local` value to the
nearest step, and sub-second support is not uniform. Chromium keeps the milliseconds - which is
what `browser_checks.cjs` verified - but a browser that rounds to the whole minute would hand
`event.target.value` back without the seconds you put in. Follow that through the edit flow and
you find a nasty failure:

1. A booking runs from `10:00:30.500Z`.
2. `edit()` writes that instant into the input as a local string with milliseconds.
3. The browser normalises the displayed value to `10:00`.
4. The user changes **only the title** and saves.
5. The old code did `new Date(form.startsAt).toISOString()`, so it sent `10:00:00.000` - and the
   meeting silently moved by thirty seconds. Worse, it might now overlap the booking before it
   and come back as a 409 the user cannot explain.

A change that only touched the title moved the time. That is the worst class of bug: invisible,
data-losing, and impossible to reproduce on the developer's browser.

The containment is to keep the authoritative value and only re-derive when the user actually
typed. `App.tsx` records both the original ISO instants and the exact strings it wrote into the
inputs when the editor opened:

```tsx
original.current = { startsAt: booking.startsAt, endsAt: booking.endsAt, startsAtInput, endsAtInput };
```

and on submit:

```tsx
startsAt: kept && form.startsAt === kept.startsAtInput ? kept.startsAt : new Date(form.startsAt).toISOString(),
```

If the field still holds the string we put there, nothing the user did concerned the time, so the
**original instant** is sent verbatim - no parse, no round trip, no normalisation. If the string
differs, the user edited it and re-parsing is correct.

Two general lessons worth more than the fix:

- **A form control is an input device, not a source of truth.** Anything you read back from one
  has been through the browser's own normalisation. If a value must survive a round trip
  unchanged, keep the original and compare.
- **Name your environment dependencies.** "Works in Chromium" is a fact about your test
  environment. Write it down where the next person will look - which is why this section exists
  and why [VERIFICATION.md](VERIFICATION.md) now says which browser was checked.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> The UI edits existing ids and converts local input to explicit instants. The API validates ids, bounded text, real timestamps and forward windows. Day views send browser-local boundaries; a legacy date query explicitly means a UTC day. Database overlap enforcement is verified under concurrency and failed edits.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Bookings link a room UUID to a title, bookedBy label and two instants. PostgreSQL stores timestamptz and enforces room-specific nonoverlap using a GiST exclusion constraint.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
