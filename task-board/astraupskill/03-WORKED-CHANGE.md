# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Deletion previously filtered the task out and saved the smaller array. The information needed to reverse deletion was lost.

**After:** One localStorage value now holds both the visible tasks and the most recent deleted task. Delete and undo persist before publishing their new in-memory state. Undo clears old filters so the restored task is visible.

## Predict this example

Start with task ids [a, b, c]. Delete b: visible ids become [a, c] and recovery stores b at index 1. Reload. Undo: ids become [a, b, c], and recovery becomes null. A second undo changes nothing.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 122. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function commitBoard(tasks, deleted) {
  try {
    // Persist first. A quota/security error must not consume an undo or hide a task.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tasks, deleted }));
  } catch {
    showMessage("Could not save this change. Your task and undo history are unchanged.");
    return false;
  }
  state.tasks = tasks;
  state.deleted = deleted;
  return true;
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

An inverse operation needs enough information to reconstruct the prior intent. Saving just an id would not restore the title, date or notes. Saving the entire old array would be equally troublesome: undo could erase a task added after deletion. Keeping one deleted record and its insertion position preserves unrelated work. This is a small command-history design, not a full event log. The product policy is deliberately one-level undo: deleting c after deleting a replaces the recovery record for a. A stack of multiple deletions is a separate exercise. localStorage writes one string atomically; two separate keys would allow a task list and an undo record to disagree if the second write failed. Publishing the UI only after a successful write makes the failure behavior easy to reason about.

### The changed lines in `handleSubmit`

`commitBoard` is new, so every line of the excerpt above is a changed line. The other half of the change is smaller and easier to miss. In the pre-change file (`AstraOrganized2/astrafinalplan/implementation/backups/01/app.js:84-92`) the create and edit branch mutated `state` first and then called the unguarded `saveTasks()`:

```javascript
  if (state.editingId) {
    state.tasks = state.tasks.map((item) => item.id === state.editingId ? task : item);
    showMessage("Task updated.");
  } else {
    state.tasks.unshift(task);
    showMessage("Task added.");
  }

  saveTasks();
```

Today the same branch reads ([app.js](../app.js) lines 94-101):

```javascript
  const nextTasks = state.editingId
    ? state.tasks.map((item) => item.id === state.editingId ? task : item)
    : [task, ...state.tasks];

  // Create and edit obey the same persist-then-publish rule as delete and undo.
  if (!commitBoard(nextTasks, state.deleted)) return;

  showMessage(state.editingId ? "Task updated." : "Task added.");
```

Three separate things changed and each one is observable.

1. `state.tasks.unshift(task)` mutated the array the UI was already reading. `[task, ...state.tasks]` builds a *replacement* that the caller can discard for free if the write fails. This is the same shape as `state.tasks.filter(...)` in `deleteTask` (`app.js:139`).
2. The success message moved *after* the write. Previously "Task added." was printed and the task rendered even when `localStorage.setItem` threw, so the task vanished on the next reload.
3. `state.deleted` is passed straight through, so adding a task neither consumes nor clears the pending undo record. Case 4 of the test suite asserts exactly that (`deleted.task.id === 'b'` after a successful create).

`saveTasks()` (`app.js:73`) survives as the raw, unguarded write. Nothing in the application calls it any more; it exists so a test fixture can mutate `state` directly and flush it, which is what case 2 does with `state.tasks[0].title = 'Edited B'; saveTasks();`. If you remove it, that test must be rewritten first.

## Three variations to work through

Run each of these against the `['a','b','c']` fixture in [test/undo.test.cjs](../test/undo.test.cjs) and write your prediction down before executing.

**Variation 1 - delete, add, then undo.** `deleteTask('b')` then submit a task titled `d`, then click undo. Predicted stored order: `['b', 'd', 'a', 'c']`. New tasks are prepended by `[task, ...state.tasks]`, so at undo time the array is `['d','a','c']` and `b` is reinserted at its *recorded* index 1... which now sits between `d` and `a`. Run it: the stored order is `['d', 'b', 'a', 'c']`. The stored index is a position in the array as it was at deletion time, not a relationship to its neighbours, and the course's "id is not position" claim is exactly what makes this survivable rather than corrupting. Write the assertion that pins whichever behaviour you decide is correct.

**Variation 2 - delete the last task, then delete another, then undo.** With `['a','b','c']`, `deleteTask('c')` records index 2; then `deleteTask('a')` replaces the recovery record with `{task: a, index: 0}` (one-level undo). Undo restores `['a','b']`. Predict the number of storage writes: three, one per successful `commitBoard`. `c` is gone for good, which is the product policy, not a bug - prove it by asserting `result.tasks.map(t => t.id)` is `['a','b']` and `result.deleted === null`.

**Variation 3 - undo into a shrunken array.** Delete `c` (index 2), then delete `b`, then `a`, so only the `a` recovery record survives and `state.tasks` is `[]`... except one-level undo means only the last deletion is recoverable. Instead force the boundary directly: `deleteTask('c')` records index 2, then `state.tasks = []; saveTasks();` in the fixture, then `undoDelete()`. `splice(Math.min(index, tasks.length), 0, task)` clamps 2 to 0, so the task is restored at the front instead of throwing or leaving a hole. Remove the `Math.min` in a scratch copy and re-run: `splice` silently appends at the end instead, which is the quiet difference the clamp makes explicit.

## Executable examples

These are the first three of the five regression tests in [test/undo.test.cjs](../test/undo.test.cjs); cases 4 and 5 cover the create path described above. Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");
const KEY = "js1-task-board";
const tasks = ["a", "b", "c"].map((id) => ({
  id,
  title: id,
  due: "2026-10-01",
  priority: "Low",
  status: "Backlog",
  notes: "",
}));
test("legacy data upgrades; undo after reload restores identity and position once", async () => {
  let app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  const saved = app.snapshot();
  app.close();
  app = await openApp(saved);
  assert.equal(app.document.querySelector("#undo-delete").disabled, false);
  app.event("#undo-delete", "click");
  let result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["a", "b", "c"],
  );
  assert.equal(result.deleted, null);
  app.evaluate("undoDelete()");
  assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).tasks.length, 3);
  app.close();
});
test("undo preserves intervening edits and uses only the latest deletion", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate(
    "deleteTask('a'); state.tasks[0].title = 'Edited B'; saveTasks(); deleteTask('c'); undoDelete()",
  );
  const result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["b", "c"],
  );
  assert.equal(result.tasks[0].title, "Edited B");
  app.close();
});
test("failed storage does not delete a task or consume recovery data", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); }; deleteTask('b')",
  );
  assert.equal(app.evaluate("state.tasks.length"), 3);
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /Could not save/,
  );
  app.close();
});
test("creating a task persists before publishing and keeps the undo record", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  app.evaluate(
    "document.querySelector('#task-title').value = 'New task';" +
      "document.querySelector('#task-due').value = '2026-11-01';",
  );
  app.event("#task-form", "submit");
  const result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.title),
    ["New task", "a", "c"],
  );
  assert.equal(result.deleted.task.id, "b");
  assert.equal(app.evaluate("state.tasks.length"), 3);
  app.close();
});
test("failed storage on create adds no task and does not consume recovery data", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); };" +
      "document.querySelector('#task-title').value = 'New task';" +
      "document.querySelector('#task-due').value = '2026-11-01';",
  );
  app.event("#task-form", "submit");
  assert.equal(app.evaluate("state.tasks.length"), 2);
  assert.equal(app.evaluate("state.deleted.task.id"), "b");
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /Could not save/,
  );
  app.close();
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
