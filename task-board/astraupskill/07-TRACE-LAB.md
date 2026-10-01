# Trace lab: restoring one deleted task

[Course index](README.md)

## Identity and position are different

An id belongs to a task; an index describes its current position. Start with ids `[a, b, c]`, delete b, and store b's complete object with insertion index 1. The visible list becomes `[a, c]`. Reload and undo should restore `[a, b, c]` and consume recovery once.

Now rename c between deletion and undo. Its new title must survive. Restoring an old snapshot of the entire board would erase that edit. Keeping one deleted object restores the intended record without replacing unrelated work.

## Follow the failure branch

Open `commitBoard` in [app.js](../app.js). It serializes tasks and recovery together, writes one storage value, and only then publishes memory state. A `try` block alone is not atomicity: the useful boundary is the single storage operation. Splitting tasks and recovery between two keys would allow the first write to succeed and the second to fail.

Predict a failed undo. The deleted task should remain recoverable, so the user can retry. Run the failure fixture in the test linked in chapter 3 and inspect saved state, not only error text.

One-level undo deliberately replaces the older recovery record when another deletion succeeds. A stack can store more history, but you must still decide whether renames and moves enter that history and what each inverse means. Explain these four distinct safeguards: stable id, insertion position, one storage value, and write-before-publication.
## The six boundaries of one delete-and-undo round trip

A browser-only app has the same boundaries as an API; they are just all in one file. Walk them in order with [app.js](../app.js) open, and write down the value entering and leaving each one.

**1. The input surface (DOM) - `index.html` + `app.js:31-58`.** The board has two input surfaces and they are worth separating. The form (`#task-form`, bound at `app.js:49`) carries create and edit; the per-card Delete button is created in `render` and bound inline at `app.js:211` with the task's id captured in the closure. Nothing here validates or stores. Ask of each: what exactly is handed to the next layer? The form hands over six raw strings; the card hands over one id.

**2. Normalization - `handleSubmit`, `app.js:80-88`.** This is the layer that turns browser values into a domain record: `titleInput.value.trim()`, `notesInput.value.trim()`, and `idInput.value || crypto.randomUUID()` which decides create-versus-edit by whether a hidden field is populated. Trimming is normalization, not validation - it changes a value it will accept. Note that `priority` and `status` are taken straight from `<select>` elements and are trusted for their bounded vocabulary, which is a real assumption: anyone with devtools can add an `<option>`.

**3. The action boundary - `handleSubmit:89-92`, `deleteTask:136-137`, `undoDelete:146-151`.** Each named action decides whether the operation happens at all. `handleSubmit` rejects an empty title or due date. `deleteTask` early-returns when `findIndex` yields `-1`. `undoDelete` has two guards: no recovery record, and a recovery record whose id is already present (which would create a duplicate after, say, a restore in another tab). In an Express app these three are the route handler's job; here they are three guards in three functions. For each, answer: has anything been written yet? For all three, no.

**4. The intended-change computation - `handleSubmit:94-96`, `deleteTask:138`, `undoDelete:151-152`.** Every path builds a *replacement* array and leaves `state.tasks` alone: `[task, ...state.tasks]`, `state.tasks.filter(...)`, and `[...state.tasks]` followed by `splice`. This is the layer an ORM would call "build the entity to save". The discipline matters because of what comes next: if layer 5 fails, the replacement is simply dropped and nothing has to be undone.

```javascript
const index = tasks.findIndex(task => task.id === 'b');
const remaining = tasks.filter(task => task.id !== 'b');
```

This reduced example creates a new array, but retained objects are still references to the old objects. `filter` is not a deep copy - edit `remaining[0].title` and the original array sees it too.

**5. The persistence boundary - `commitBoard`, `app.js:122-133`.** One function, one storage operation, for all four write paths. `JSON.stringify({version: 2, tasks, deleted})` serializes tasks and recovery into a single string, and `localStorage.setItem` writes that one key atomically. This is where a transaction would be in a database project, and the analogy is exact: the guarantee comes from the storage primitive, not from the `try` block around it. Two keys would mean two operations and no guarantee. Confirm the ordering for yourself: `state.tasks` and `state.deleted` are assigned at lines 130-131, *after* `setItem` returned.

**6. Publication and render - `commitBoard:130-131` then `render`, `app.js:178-214`.** Publishing is the assignment to `state`; rendering is `render()` recomputing the visible list from `state` through `getVisibleTasks` (`app.js:170`) and resetting `undoButton.disabled` from `state.deleted`. Nothing here is a second source of truth - which is why `undoDelete` can clear the filters (`app.js:155-157`) and simply re-render to make the restored task visible. Ask the last question of this layer: what does a repeated call do? `render()` is idempotent; `undoDelete()` is not, but its guard at line 146 makes the second call a no-op.

Now run the trace backwards from a failure. Patch `Storage.prototype.setItem` to throw, delete a task, and identify exactly which of the six layers observed the failure (5), which reported it (5, via `showMessage`), and which never ran (6). That asymmetry - the failing layer is not the reporting layer, and the layers above it have already finished - is what makes step 3 of the debugging workflow in chapter 4 useful.
