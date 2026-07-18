# Task Board Codebase Guide

This guide is for reading the project like a junior engineer joining a larger frontend codebase. The app is small, but the same ideas show up in production: state, validation, rendering, event handlers, persistence, and derived views.

## Code Map

- `index.html` defines the form fields, filter controls, list container, and empty state.
- `styles.css` owns layout and visual states such as pills, buttons, and responsive behavior.
- `app.js` owns all behavior: loading data, mutating task state, saving to `localStorage`, filtering, and rendering.

## Main Data Model

Each task is a plain object:

```js
{
  id: crypto.randomUUID(),
  title: "Sketch the data model",
  priority: "High",
  status: "Backlog",
  due: "2026-06-20",
  notes: "Identify fields before writing render code."
}
```

Corporate codebases usually call this a domain model. When adding a field, update every place that reads or writes the model: starter data, form serialization, edit population, search text, and render output.

## State Shape

`app.js` keeps one state object:

```js
const state = {
  tasks: loadTasks(),
  query: "",
  status: "All",
  editingId: null
};
```

This pattern scales. Instead of scattering global variables everywhere, group related view state together. `tasks` is persistent domain state; `query`, `status`, and `editingId` are UI state.

## Create and Update Flow

The submit handler chooses between create and update based on `state.editingId`:

```js
if (state.editingId) {
  state.tasks = state.tasks.map((item) => item.id === state.editingId ? task : item);
  showMessage("Task updated.");
} else {
  state.tasks.unshift(task);
  showMessage("Task added.");
}
```

This is a classic CRUD branch. In larger React apps, this same logic often moves into a reducer, service function, or API route.

## Render Flow

The UI is rebuilt from data:

```js
const tasks = getVisibleTasks();
taskList.innerHTML = "";
taskCount.textContent = tasks.length;
emptyState.hidden = tasks.length > 0;
```

The important habit: render from state, not from assumptions about the DOM. If a bug appears, inspect the state first, then inspect the DOM.

## Search and Filter

```js
const matchesStatus = state.status === "All" || task.status === state.status;
const searchable = `${task.title} ${task.priority} ${task.status} ${task.notes}`.toLowerCase();
return matchesStatus && searchable.includes(state.query);
```

This is client-side querying. In a corporate app, this may become a server query like `/api/tasks?status=Done&q=test`. The conceptual shape stays the same.

## Extension Practice

- Add an `estimateHours` field.
- Add a due-date sort.
- Add a "Done today" quick action.
- Prevent deleting without confirmation.
- Move storage functions into a separate `store.js` module.

Before changing code, write down the affected surfaces: model, form, validation, storage, search, render, tests/manual QA.
