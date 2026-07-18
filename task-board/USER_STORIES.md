# Task Board - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.
Each plan names the exact file and function to change so a junior engineer can
follow it directly.

> **Architecture recap:** all logic is in `app.js`. State lives in the `state`
> object (`{ tasks, query, status, editingId }`). `render()` rebuilds the list
> from `getVisibleTasks()`. Records are created/edited in `handleSubmit`, saved
> with `saveTasks()`, and persisted to `localStorage` under `STORAGE_KEY`.
> Markup is in `index.html`; styles in `styles.css`.

---

## Story 1: Sort tasks by due date or priority
**As a** user, **I want** to sort the board, **so that** the most urgent work is at the top.

### Acceptance criteria
- [ ] A "Sort" dropdown appears in the toolbar with options: Due date, Priority, Newest.
- [ ] Changing it re-orders the visible list immediately.
- [ ] The chosen sort persists across reloads.

### Implementation plan
1. **`index.html`** - inside `.toolbar`, add a `<select id="sort-select">` with `<option value="due">`, `value="priority"`, `value="created"`.
2. **`app.js`** - add `sort: "due"` to the `state` object, and load/save it (extend `STORAGE_KEY` data or add a second key `js1-task-board-sort`).
3. **`app.js`** - add a listener: `sortSelect.addEventListener("change", e => { state.sort = e.target.value; render(); })`.
4. **`app.js`** - in `getVisibleTasks()`, after filtering, `.sort()` the array: for `due` compare `new Date(a.due) - new Date(b.due)`; for `priority` map `{High:0,Medium:1,Low:2}` and compare; for `created` keep insertion order (tasks are `unshift`ed, so newest is already first).
5. Tasks have no `createdAt`; for "Newest" rely on array order, or add `createdAt: new Date().toISOString()` in `handleSubmit` when creating.

### How to test
Add tasks with different due dates/priorities, switch the dropdown, confirm order changes and survives reload.

---

## Story 2: Highlight overdue and due-soon tasks
**As a** user, **I want** overdue tasks flagged, **so that** I notice deadlines.

### Acceptance criteria
- [ ] A task whose `due` is before today (and status   Done) shows a red "Overdue" badge.
- [ ] A task due within 2 days shows an amber "Due soon" badge.
- [ ] Done tasks never show either badge.

### Implementation plan
1. **`app.js`** - add a helper `function dueState(task)` returning `"overdue" | "soon" | "ok"` by comparing `new Date(task.due + "T00:00:00")` to a `startOfToday()` date (set hours to 0).
2. **`app.js`** - in `render()`, after building the card, compute `dueState(task)` and, when not `"ok"` and `task.status !== "Done"`, insert a `<span class="pill due-overdue">Overdue</span>` (or `due-soon`) into `.pill-row`.
3. **`styles.css`** - add `.pill.due-overdue { color:#7a271a; background:#ffe0e0; }` and `.pill.due-soon { color: var(--warn); background:#fff2c2; }`.

### How to test
Create a task with yesterday's date -> red badge; tomorrow -> amber; mark Done -> badge disappears.

---

## Story 3: Add tags and filter by them
**As a** user, **I want** comma-separated tags, **so that** I can group related tasks.

### Acceptance criteria
- [ ] The form accepts comma-separated tags; they render as chips on the card.
- [ ] Clicking a chip filters the board to that tag.
- [ ] An "All tags" reset clears the tag filter.

### Implementation plan
1. **`index.html`** - add `<input id="task-tags">` to the form.
2. **`app.js`** - in `handleSubmit`, parse `tags: tagsInput.value.split(",").map(t=>t.trim()).filter(Boolean)`. Add `tags: []` to `starterTasks` items so old data still renders.
3. **`app.js`** - add `tag: null` to `state`. In `getVisibleTasks()`, add `&& (!state.tag || task.tags?.includes(state.tag))`.
4. **`app.js`** - in `render()`, build a chip per tag with a click handler `() => { state.tag = tag; render(); }`. Show the active tag and a "clear" chip when `state.tag` is set.
5. **`editTask`** - populate `tagsInput.value = task.tags.join(", ")`.

### How to test
Add a task with `urgent, frontend`, click `urgent`, confirm only matching tasks show; clear resets.

---

## Story 4: Clear all completed tasks
**As a** user, **I want** one button to remove every Done task, **so that** the board stays tidy.

### Acceptance criteria
- [ ] A "Clear done" button appears near the count and shows how many will be removed.
- [ ] Clicking it asks for confirmation, then deletes all `status === "Done"` tasks.
- [ ] The button is disabled when there are zero Done tasks.

### Implementation plan
1. **`index.html`** - add `<button id="clear-done" class="secondary">` in the `.section-header`.
2. **`app.js`** - add a listener that runs `if (!confirm("Remove all done tasks?")) return; state.tasks = state.tasks.filter(t => t.status !== "Done"); saveTasks(); render();`.
3. **`app.js`** - in `render()`, set `clearDone.disabled = !state.tasks.some(t => t.status === "Done")` and update its label to `Clear done (N)`.

### How to test
Mark two tasks Done, click the button, confirm both vanish and the count updates; with none Done the button is disabled.

---

## Story 5: Export and import the board as JSON
**As a** user, **I want** to back up and restore my tasks, **so that** I don't lose them.

### Acceptance criteria
- [ ] An "Export" button downloads `tasks.json` containing the current tasks.
- [ ] An "Import" file picker replaces the board with a valid uploaded file.
- [ ] Invalid JSON shows an error and changes nothing.

### Implementation plan
1. **`index.html`** - add `<button id="export-btn">` and `<input type="file" id="import-input" accept="application/json">`.
2. **`app.js` (export)** - build a Blob: `const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {type:"application/json"})`, create an object URL, set it on a temporary `<a download="tasks.json">`, call `.click()`, then `URL.revokeObjectURL`.
3. **`app.js` (import)** - on `change`, read the file with `await file.text()`, `JSON.parse` inside try/catch. Validate it is an array of objects each having `id` and `title`. On success `state.tasks = parsed; saveTasks(); render();`. On failure `showMessage("Invalid file.")`.
4. Generate fresh ids on import if any are missing (`item.id ||= crypto.randomUUID()`).

### How to test
Export, edit the board, import the file, confirm the board is restored; import a non-JSON file and confirm the error.

