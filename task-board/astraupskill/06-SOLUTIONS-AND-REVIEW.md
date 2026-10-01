# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

One localStorage value now holds both the visible tasks and the most recent deleted task. Delete and undo persist before publishing their new in-memory state. Undo clears old filters so the restored task is visible.

The key model is: The v2 document is {version: 2, tasks: [...], deleted: {task, index} | null}. A legacy array becomes a document with deleted: null. The task id is stable across delete and restore; its array position is not its identity.

The worked fixture should behave as follows: Start with task ids [a, b, c]. Delete b: visible ids become [a, c] and recovery stores b at index 1. Reload. Undo: ids become [a, b, c], and recovery becomes null. A second undo changes nothing.

## Extension solutions

### Exercise 1

**Prompt:** Add an accessible announcement that names the restored task.

**Approach:** `#form-message` already carries `role="status"`, so writing to it announces. The restored title is available before the write, but you must only announce after `commitBoard` returns true.

```javascript
function undoDelete() {
  if (!state.deleted) return;
  const { task, index } = state.deleted;
  if (state.tasks.some((item) => item.id === task.id)) {
    showMessage("That task already exists; undo would create a duplicate.");
    return;
  }
  const tasks = [...state.tasks];
  tasks.splice(Math.min(index, tasks.length), 0, task);
  if (!commitBoard(tasks, null)) return;
  state.query = ""; state.status = "All";
  searchInput.value = ""; statusFilter.value = "All";
  showMessage(`Restored "${task.title}".`);   // textContent, never innerHTML
  render();
}
```

**Review:** The trap here is announcing before the write. Move `showMessage` above the `commitBoard` call and case 3's failure assertion still passes (it only checks `state.tasks.length`), but a screen-reader user is told a task was restored that was not - so add an assertion that on a failing write the message matches `/Could not save/` and does *not* contain the title. The second trap is `innerHTML`: a task titled `<img src=x onerror=alert(1)>` is stored verbatim by design, and `showMessage` must keep assigning `textContent` (`app.js:220`) or the announcement becomes an injection point. The invariant that must not move: the restored task keeps its original `id`, so the announcement names a record, not a new one.

### Exercise 2

**Prompt:** Add a two-level undo history while preserving unrelated edits.

**Approach:** Keep the document single-valued, but make `deleted` a bounded stack. Bump `version` to 3 and upgrade v2 documents on read rather than discarding them.

```javascript
const UNDO_LIMIT = 2;

function loadBoard() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { tasks: starterTasks, deleted: [] };
  const parsed = JSON.parse(saved);
  if (Array.isArray(parsed)) return { tasks: parsed, deleted: [] };          // v1
  if (Array.isArray(parsed.deleted)) return parsed;                          // v3
  return { tasks: parsed.tasks, deleted: parsed.deleted ? [parsed.deleted] : [] }; // v2
}

function deleteTask(id) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const stack = [{ task: state.tasks[index], index }, ...state.deleted].slice(0, UNDO_LIMIT);
  if (!commitBoard(state.tasks.filter((task) => task.id !== id), stack)) return;
  resetForm();
  showMessage("Task deleted. The last two deletions can be undone.");
  render();
}

function undoDelete() {
  const [top, ...rest] = state.deleted;
  if (!top) return;
  if (state.tasks.some((item) => item.id === top.task.id)) {
    showMessage("That task already exists; undo would create a duplicate.");
    return;
  }
  const tasks = [...state.tasks];
  tasks.splice(Math.min(top.index, tasks.length), 0, top.task);
  if (!commitBoard(tasks, rest)) return;   // pop only on a successful write
  state.query = ""; state.status = "All";
  showMessage("Task restored.");
  render();
}
```

**Review:** The one line that carries the whole lesson is `if (!commitBoard(tasks, rest)) return;`. Pop the stack into a local variable first and you have consumed a recovery record for a write that never happened - exactly the bug case 3 was written to catch, reintroduced one level up. Demonstrate it: delete two tasks, patch `Storage.prototype.setItem` to throw, click undo twice, then repair `setItem` and assert `state.deleted.length` is still 2. The invariant that remains unchanged: `render` still derives `undoButton.disabled` from the recovery data (`!state.deleted.length` now), so there is still no independently mutable "can undo" flag. Note also that you must keep reading v2 documents; a learner who writes `parsed.deleted ?? []` silently drops a real pending undo.

### Exercise 3

**Prompt:** Handle malformed saved JSON without silently overwriting the original value.

**Approach:** `loadBoard` (`app.js:62`) currently lets `JSON.parse` throw at module load, which kills the whole script before any handler is bound - the page looks dead rather than degraded. Catch parsing separately from writing, and never overwrite the bytes you could not read.

```javascript
const QUARANTINE_KEY = `${STORAGE_KEY}:unreadable`;
let loadFailure = null;

function loadBoard() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { tasks: starterTasks, deleted: null };
  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch {
    // Keep the original bytes. Do not write to STORAGE_KEY on this path.
    try { localStorage.setItem(QUARANTINE_KEY, saved); } catch { /* ignore */ }
    loadFailure = "Your saved board could not be read. It has been kept; the board below is empty until you reset or restore it.";
    return { tasks: [], deleted: null };
  }
  if (Array.isArray(parsed)) return { tasks: parsed, deleted: null };
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
    loadFailure = "Your saved board had an unexpected shape and was not loaded.";
    return { tasks: [], deleted: null };
  }
  return { tasks: parsed.tasks, deleted: parsed.deleted ?? null };
}
```

Then show `loadFailure` through `showMessage` after the DOM handles are bound, and put the reset behind an explicit button rather than the first save.

**Review:** The failure most people ship here is *recovering* by writing an empty board straight back to `STORAGE_KEY`, which destroys the user's data in the name of fixing it. Demonstrate the difference with a fixture: `openApp({ 'js1-task-board': '{"version":2,"tasks":' })`, then assert both that the app renders (a task can still be added) and that `localStorage.getItem('js1-task-board:unreadable')` still holds the original truncated string. The invariant that remains unchanged: writes still go through `commitBoard`, so the corrupt value is only replaced when a real user action succeeds. Note the subtlety in the shape check - `Array.isArray(parsed.tasks)` matters because `JSON.parse('null')` and `JSON.parse('7')` both succeed and would otherwise reach `render` as a crash.

### Exercise 4

**Prompt:** Design a multi-tab conflict policy for two tabs deleting different tasks.

**Approach:** Be honest that this one is a design answer, not a fix. The `storage` event fires in *other* tabs after a write lands, which makes detection possible and prevention impossible from JavaScript alone: there is no compare-and-swap for `localStorage`.

A workable policy for this app, in order of cost:

1. **Detect and reload.** Listen for the event and re-publish rather than merge.

   ```javascript
   window.addEventListener("storage", (event) => {
     if (event.key !== STORAGE_KEY || event.newValue === null) return;
     const board = loadBoard();
     state.tasks = board.tasks;
     state.deleted = board.deleted;
     showMessage("This board changed in another tab. The list has been refreshed.");
     render();
   });
   ```

2. **Detect and warn on conflict.** Stamp each write with `{ writer, seq }` where `writer` is a per-tab id and `seq` increments. Before `commitBoard` publishes, re-read the stored document; if its `seq` is not the one this tab last wrote, the board moved underneath you. Refuse the write and tell the user, rather than clobbering.
3. **Move the authority out of the tab.** A `BroadcastChannel` still has no arbiter. Real last-writer-detection needs a single owner - a `SharedWorker`, or the server in the API projects later in this path, where a `WHERE version = $1` update does the compare-and-set that `localStorage` cannot.

**Review:** The claim to reject is "I added a `storage` listener, so the app is multi-tab safe." Option 1 is strictly last-writer-wins with a nicer screen: two tabs deleting different tasks still ends with one deletion lost, and you should be able to demonstrate that with two `openApp` instances sharing a snapshot. Option 2 detects that loss but cannot prevent it, because the read and the write are two operations with a gap between them. The invariant that remains unchanged throughout: one key, one write, so a *single* tab never observes a half-updated board - which is what makes the cross-tab problem a merge question rather than a corruption question.

## Answer to the chapter-5 exercise-0 question

Against the pre-change create path, case 5 ("failed storage on create adds no task and does not consume recovery data") fails: `state.tasks.unshift(task)` runs before the write, so `state.tasks.length` is 3, not 2. Case 4 also fails, but for a duller reason - the old `saveTasks()` wrote `JSON.stringify(state.tasks)`, a bare array with no `deleted` field, so `result.deleted.task.id` throws. Cases 1, 2 and 3 all pass against the old create path, because none of them submits the form. That is the general point: a suite proves the paths it exercises, and an inconsistency between two write paths is invisible until a test uses the second one.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/undo.test.cjs](../test/undo.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Deletion previously filtered the task out and saved the smaller array. The information needed to reverse deletion was lost. I changed the implementation so that: One localStorage value now holds both the visible tasks and the most recent deleted task. Delete and undo persist before publishing their new in-memory state. Undo clears old filters so the restored task is visible. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
