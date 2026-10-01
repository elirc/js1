# Concepts explained from first principles

[Course index](README.md)

## The central idea: independent predicates, calendar rules and validation

A single status can hide independent dimensions. Compute low and expired separately and compose them for each view. Equality at the stock threshold is intentional: stock equal to minimum is already low. Equality at the date boundary has a different rule: this app treats the labeled date as valid through that day. Valid ISO labels sort chronologically, so string comparison is useful only after date validation. Reading local year, month and day avoids a UTC conversion that could shift the calendar label. This is an inventory software rule, not food-safety guidance. Visibility refresh does not schedule an exact update at midnight in a continuously visible tab. Existing malformed storage is not automatically migrated.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Rows show stock and expiration independently. Expired filtering is available, and the in-stock/nonexpired view excludes expired items. New quantities must be finite and nonnegative, dates must be real, and returning to the tab refreshes date-based status.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Quantity, minimum and expiration are separate fields. Low means quantity <= minimum. Expired means the YYYY-MM-DD label is earlier than local today.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Why `toISOString()` is the wrong way to ask "what is today?"

This is the single most reusable idea in the lesson, and in the code it is only four lines
(`localToday`, `app.js:180-183`) with no comment. It deserves a section.

A date in this app is a **calendar label**: `"2026-09-08"` means the day a human in front of this
browser would call September 8th. A `Date` object is not a calendar label - it is an instant, a
number of milliseconds since 1970 - and the same instant has a different calendar label in
different places. Converting one to the other requires choosing a timezone, and `toISOString()`
always chooses **UTC**:

```javascript
// It is 23:00 on September 8th for a user in New York (UTC-4).
const now = new Date();
now.toISOString().slice(0, 10);   // "2026-09-09"  <- UTC has already rolled over
`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                                  // "2026-09-08"  <- what the user calls today
```

Work through the consequence in this app. `isExpired` is `item.expires < today` (`app.js:185`).
With the `toISOString` version, at 20:00 in New York a jar expiring on the 8th is already
reported **Expired**, four hours early, every single evening. The user in Berlin has the mirror
bug at 01:00: UTC still says the 7th, so a jar that expired yesterday reads fine for two hours
each morning. Neither user can reproduce the other's report, and the developer in London sees
nothing wrong at all - which is exactly the kind of bug that survives three sprints.

`localToday` uses `getFullYear()`, `getMonth()` and `getDate()`, which are the **local** getters,
so it asks the browser the question the user would answer. `padStart(2, "0")` is not cosmetic
either: the zero padding is what makes `"2026-09-08" < "2026-09-09"` a correct date comparison as
plain strings. Drop it and `"2026-9-8" < "2026-9-10"` is `false`, because `'8' > '1'`.

Three rules to carry away:

1. **Decide whether a value is an instant or a calendar label, and never let the two mix.** An
   `expires` field on a pantry item is a label. A `createdAt` audit timestamp is an instant and
   should be stored as UTC.
2. **If it is a label, build it from local getters** - or, better, from a library that makes the
   timezone an explicit argument. `toISOString().slice(0, 10)` on a local date is almost always
   a bug.
3. **Zero-pad, then compare as strings.** ISO-8601 was designed so lexicographic order is
   calendar order; that only holds for fixed-width fields.

And one open question this app does not answer, worth noticing: the *server*'s idea of today, if
this ever grows a server, will be a third answer again. Whose timezone owns "expired" is a
product decision, not a technical one.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
