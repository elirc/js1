# Concepts explained from first principles

[Course index](README.md)

## The central idea: filter composition, deterministic ordering and summaries

A view is a projection of authoritative data. Combine predicates with AND so matching search text cannot bypass the selected status. Compute the matching count from the projection and the finished count from all books. JavaScript sort mutates its input; the spread copy protects the saved array. Deterministic ties keep the display understandable when scores match. Comparing titles after ratings expresses a user-facing order, while id is a final stable tie-breaker. Tests inspect headings and serialized order because either alone misses part of the guarantee. Filters reset on reload; this change does not persist preferences or merge duplicate books.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Status filtering composes with search and sorting. Rating ties use title then id. The live summary distinguishes visible books from overall finished count, and sorting preserves saved order.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Saved books contain id, title, author, status, rating and notes. Search, status filter and sorting are temporary view state.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. `saveBook` does this deliberately at
`app.js:74`: `id: idInput.value || crypto.randomUUID()` - an edit reuses the hidden field's
value, so the record keeps its identity and the map at `app.js:87` replaces it in place rather
than appending a duplicate.

Compute display-only values from authoritative data when feasible, so there are fewer
independently mutable facts to keep synchronized. `#reading-summary` is a good example and a
warning at once: `Showing ${visibleBooks.length} of ${books.length}` and the finished count are
all derived at render time (`app.js:146-149`), so none of them can go stale - but they are
derived from **two different sources**, and mixing them up is the bug this lesson is about.

### The legacy-data hazard on the tie-break

Be careful when converting between strings and numbers. `Number('')` is zero, JSON cannot
faithfully represent `Infinity`, and a date string has different semantics from a timestamp.
This project has a concrete instance of the problem, and it is worth sitting with because it is
the shape of most "it broke in production only" bugs:

```javascript
// the comparator as originally delivered
return a[sortMode].localeCompare(b[sortMode]) || a.id.localeCompare(b.id);
```

`localeCompare` is a method of `String.prototype`. Every id this build creates is a string,
because `crypto.randomUUID()` returns one. But `localStorage` is the **oldest data in the
system**: it holds whatever a previous build of this app wrote, plus whatever a curious user
typed into devtools. A record with `id: 20` makes `a.id.localeCompare` `undefined`, and calling
it throws a `TypeError` from inside `Array.prototype.sort`. That exception escapes
`renderBooks`, so `#books` is left empty - the page looks broken, and nothing on screen suggests
the cause is one old record.

Two defensible fixes. Coerce at the point of use, which is what the code now does:

```javascript
const byId = String(a.id).localeCompare(String(b.id));
```

Or validate on load, in `loadBooks` (`app.js:61-64`), and normalise every record's id to a
string once. The first is cheaper and local; the second means the rest of the program can assume
a shape. What you must not do is assume the data on disk matches the data your code writes
today. Note the consequence of the cheap fix, and say it out loud: string ordering puts `"20"`
before `"3"`. Coercion made the comparator total and crash-free, not numerically sensible - and
for a tie-break whose only job is determinism, that is the right trade.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
