# Concepts explained from first principles

[Course index](README.md)

## The central idea: local dates, derived statistics and edge cases

Neighboring local midnights may be 23 or 25 hours apart at daylight-saving changes. The history stores calendar labels, so bestStreak maps validated labels to UTC day ordinals only to compare adjacency. It does not reinterpret the habit as a UTC activity. Reject impossible dates by round-tripping their calendar representation: JavaScript may normalize February 30 into March. Sort ordinals, increase a run for a difference of one, reset it at a gap, and retain the maximum. Current streak uses local today and permits yesterday as an anchor because the user still has today to complete the habit. A complete missed day breaks it. Explain this rule rather than presenting it as the only possible definition of streak.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> A current streak may continue through yesterday while today is still in progress. The best badge counts consecutive real dates, ignoring invalid, false and future entries. Day buttons have full accessible names.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization: why `2024-02-30` is the hard case

Validation rejects values the operation cannot accept. Normalization converts acceptable values
to the representation the rest of the program expects. The two get confused when the
normalizing function is *also* willing to accept nonsense - which is exactly the situation with
JavaScript dates, and it is the single most reusable idea in this lesson.

Type these four lines into a console before reading on:

```javascript
new Date('2024-02-30T00:00:00Z');                    // Sat Mar 02 ... - NOT an error
isNaN(Date.parse('2024-02-30T00:00:00Z'));           // false - "it parsed fine"
new Date('2024-02-30T00:00:00Z').toISOString();      // '2024-03-01T00:00:00.000Z'
new Date('2024-13-01T00:00:00Z');                    // Invalid Date - this one DOES fail
```

February 30 does not exist, and `Date` does not say so. It *normalizes* - rolls the overflow
forward into March - and returns a perfectly valid object. So the usual guard, "parse it and
check for `NaN`", passes an impossible date straight through. Month 13 happens to fail because
the field is out of the syntactic range, which makes the `isNaN` check look like it works right
up until someone hand-edits a day number.

The delivered code at `app.js:210-214` rejects it by **round-trip** instead:

```javascript
const parsed = new Date(`${date}T00:00:00Z`);
return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
```

Read that as a question: *"after normalization, is it still the same value?"* For `2024-02-29`
the answer is yes (2024 is a leap year, so the round-trip returns `2024-02-29`). For
`2024-02-30` the answer is `2024-03-01 !== 2024-02-30`, so it is rejected. This is the general
pattern for any lenient parser - a phone-number library, a currency parser, `parseInt` - and it
costs one comparison: **normalize, then compare against the input; if they differ, the input was
never valid.**

Two supporting details in the same predicate. The shape test `/^\d{4}-\d{2}-\d{2}$/` runs
first so that `'today'` or `'2024-2-3'` never reaches `Date` at all. And `date > today` is a
**string** comparison, which is only correct because zero-padded ISO dates sort in calendar
order - the reason the whole app stores `'2024-03-09'` rather than a timestamp.

Neither operation should silently invent facts. If an imported record is malformed, do not
quietly save only the convenient subset unless that is the explicit product policy. Here the
policy is stated by the code: an unparseable or impossible key is dropped from the streak
calculation, and nothing rewrites it in storage.

Apply this distinction to the data model:

Each habit has a history map from YYYY-MM-DD to true. Current and best streaks are derived values, not independently persisted counters.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
