# Job Pipeline Codebase Guide

This project models a workflow. Workflow apps are everywhere in corporate engineering: sales pipelines, hiring systems, ticket queues, approvals, and operations dashboards.

## Code Map

- `server/server.js`: application routes and valid stage rules.
- `client/src/api.js`: API helper functions.
- `client/src/App.jsx`: form state, filters, stage counts, cards.
- `client/src/styles.css`: pipeline-style UI.

## Workflow State

```js
const stages = ["Saved", "Applied", "Interviewing", "Offer", "Closed"];
```

This list is a business vocabulary. In larger codebases, shared vocabularies should be constants or enums used by both client and server.

## Server Stage Validation

```js
if (!stages.includes(application.stage)) {
  return res.status(400).json({ error: "Choose a valid stage." });
}
```

This prevents invalid workflow states. Without it, a typo like `"intervewing"` can break filters and reporting.

## Derived Stage Counts

```js
const stageCounts = useMemo(() => {
  return applications.reduce((counts, item) => {
    counts[item.stage] = (counts[item.stage] || 0) + 1;
    return counts;
  }, {});
}, [applications]);
```

This mirrors dashboard code: compute counts from records, do not maintain separate counters manually.

## CRUD Save Flow

```js
if (editingId) {
  await updateApplication(editingId, form);
  setMessage("Application updated.");
} else {
  await createApplication(form);
  setMessage("Application created.");
}
```

The UI makes one decision: create or update. The API wrapper handles HTTP details. This separation makes components easier to reason about.

## Extension Practice

- Add an activity log per application.
- Add `PATCH /api/applications/:id/stage`.
- Add grouped columns by stage.
- Add next-step reminders.
- Move stage constants into a shared module.

Workflow apps become brittle when state names drift. Keep them centralized.
