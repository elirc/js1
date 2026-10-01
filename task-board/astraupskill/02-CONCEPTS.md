# Concepts explained from first principles

[Course index](README.md)

## The central idea: identity, immutable updates and atomic local persistence

An inverse operation needs enough information to reconstruct the prior intent. Saving just an id would not restore the title, date or notes. Saving the entire old array would be equally troublesome: undo could erase a task added after deletion. Keeping one deleted record and its insertion position preserves unrelated work. This is a small command-history design, not a full event log. The product policy is deliberately one-level undo: deleting c after deleting a replaces the recovery record for a. A stack of multiple deletions is a separate exercise. localStorage writes one string atomically; two separate keys would allow a task list and an undo record to disagree if the second write failed. Publishing the UI only after a successful write makes the failure behavior easy to reason about.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> One localStorage value now holds both the visible tasks and the most recent deleted task. Delete and undo persist before publishing their new in-memory state. Undo clears old filters so the restored task is visible.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

The v2 document is {version: 2, tasks: [...], deleted: {task, index} | null}. A legacy array becomes a document with deleted: null. The task id is stable across delete and restore; its array position is not its identity.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries in this board

Every change has an ordering. If memory changes first and persistence fails, the UI shows data that disappears after reload. This board makes one promise - **nothing is published to `state` until the single `localStorage.setItem` call has returned** - and every write path now keeps it. Here is the whole state machine as a table. `tasks` is the array in the stored document, `deleted` is the recovery record, and "published" means `state` was updated and `render()` ran.

| Start | Action | Stored `tasks` | Stored `deleted` | Published? | Message |
|---|---|---|---|---|---|
| `[a,b,c]`, `deleted: null` | submit "d" | `[d,a,b,c]` | `null` | yes | Task added. |
| `[a,b,c]`, `deleted: null` | `deleteTask('b')` | `[a,c]` | `{task: b, index: 1}` | yes | Task deleted... |
| `[a,c]`, `deleted: {b,1}` | reload | unchanged | unchanged | yes, from `loadBoard` | none |
| `[a,c]`, `deleted: {b,1}` | click undo | `[a,b,c]` | `null` | yes, filters reset | Task restored. |
| `[a,b,c]`, `deleted: null` | click undo | unchanged | unchanged | no (early return at `app.js:146`) | none |
| `[a,c]`, `deleted: {b,1}` | undo while `b` already present | unchanged | unchanged | no | That task already exists... |
| any | any write with `setItem` throwing | unchanged | unchanged | **no** | Could not save this change... |

The last row is the one the change exists for, and it is the row the test suite spends two of its five cases on: once for delete (case 3) and once for create (case 5). Notice what the table does *not* contain: a row where `tasks` changed but `deleted` did not, or the reverse. That combination is unreachable because both facts live in one JSON string written by one call, not in two keys.

A `try` block alone is not atomicity. `commitBoard` is safe because the operation inside it - `localStorage.setItem` - is itself all-or-nothing for one key. If the board were split across `js1-task-board:tasks` and `js1-task-board:undo`, the same `try` would let the first write land and the second fail, and no row of the table above would describe the result. Atomicity has to come from the storage operation, not from the shape of the JavaScript around it.

## Identity, representation and derived values in this board

A task has exactly one durable fact of identity: `id`, minted once by `crypto.randomUUID()` at `app.js:81` and never rewritten. Everything else about "where" a task is turns out to be derived, and the change depends on knowing which is which.

- **`id`** - stable. `editTask`, `deleteTask` and `undoDelete` all locate the record by id, never by position.
- **Array index** - derived, and valid only at the instant it was read. `deleteTask` (`app.js:136-138`) captures the index *before* filtering precisely because it stops being true one line later.
- **The visible list** - derived. `getVisibleTasks` (`app.js:170`) recomputes it from `state.query` and `state.status` on every render, so there is no second copy of the board to keep in sync.
- **The undo button's enabled state** - derived. `render` sets `undoButton.disabled = !state.deleted` (`app.js:179`) rather than tracking availability separately.
- **`due`** - a calendar string like `"2026-10-01"`, not a timestamp. `formatDate` (`app.js:216`) appends `T00:00:00` before constructing a `Date` so the browser parses it in local time; without that suffix `new Date("2026-10-01")` is parsed as UTC midnight and displays as 30 September for anyone west of Greenwich. Try it in a console.

The one representation change in the persistence path is JSON. `JSON.stringify` at `app.js:125` turns the whole document into a single string, which is what makes the write atomic, and `JSON.parse` at `app.js:65` turns it back. Anything JSON cannot carry - a `Date` object, `undefined`, `Infinity`, a function - would silently change shape across a reload. Every field in this document is a string, a boolean-ish null, a number or an array of those, which is not an accident.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
