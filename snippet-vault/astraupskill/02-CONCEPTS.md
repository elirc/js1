# Concepts explained from first principles

[Course index](README.md)

## The central idea: ES modules, normalization and rejected promises

A useful module boundary owns a coherent responsibility. The store decides when data changes; rendering should not guess whether storage succeeded. Construct the candidate, write it and only then assign the module variable. If serialization or storage throws, assignment is skipped and the UI preserves the form. A Set of comparison keys removes duplicate tags while the first original spelling remains visible. Feature detection for navigator.clipboard is not permission: writeText may still reject, so the helper handles the asynchronous failure. Tests import actual ES modules under a fresh module identity for each fixture. Read methods still return object references; this change does not claim deep immutability against callers mutating those objects themselves.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Create, edit and delete publish only after persistence succeeds. Tags deduplicate case-insensitively, missing edit ids and blank content are rejected, and clipboard denial returns false so the UI can explain failure.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

The store owns snippets, main.js owns forms and views, and dom.js owns rendering/clipboard work. Tags retain their first display spelling while deduplicating lowercase comparison keys.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Feedback must identify the failure - including in the UI layer

This chapter argues that an error message should tell the user what to do next. It is worth
looking at how easily that principle is lost in translation between two layers, because this
project shipped with exactly that bug.

`store.js` raises two errors on purpose, and both are already written for a person:

```javascript
if (!base.title || !base.code.trim()) throw new Error("Add a title and some code.");
if (input.id && !snippets.some((item) => item.id === input.id)) throw new Error("This snippet no longer exists.");
```

Those are different situations with different remedies. The first means *you left something
blank*. The second means *the thing you were editing is gone* - another tab deleted it, or you
restored an old backup - and the remedy is to copy your text somewhere and save it as new. A
user who reads "Could not save this snippet" for the second one will press Save again, and again.

The UI used to catch both with `catch { showMessage("Could not save this snippet. ...") }`. A
bare `catch {}` is a decision, not an absence of one: it decides that every failure is the same
failure. The delivered code now asks first:

```javascript
} catch (error) {
  showMessage(isUserFacingError(error)
    ? `${error.message} Your saved data and form are unchanged.`
    : "Could not save this snippet. Your saved data and form are unchanged.");
  return;
}
```

Note the shape of the rule, because it generalizes. `isUserFacingError` (`store.js:50-57`) is an
explicit **allow-list** of messages the module promises are safe to show. It is not
`error.message` unconditionally - a quota failure says `"quota"`, a bug says
`"Cannot read properties of undefined"`, and neither belongs in front of a user. It is not a
custom error class either, though that is the more usual answer and a fine one; an allow-list was
chosen here because it keeps `store.js` free of ceremony and puts the decision in one readable
place. What matters is that *the module that raises the error decides whether it is showable*,
rather than the UI guessing.

Three habits to take from this:

- **Never write `catch {}` with no binding.** If you genuinely want to ignore an error, write
  `catch (error) { /* why */ }` and say why in the comment.
- **Distinguish errors meant for a user from errors meant for you.** Log the second kind, show
  the first, and never do it the other way round.
- **Test the distinction, not just the throw.** The third test in
  [test/store.test.js](../test/store.test.js) asserts the two messages are different *and* that
  a quota error is classified differently from both.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
