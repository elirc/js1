# Job Pipeline - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4104**). Data
> is the in-memory `applications` array (fields: `id, company, role, stage,
> contact, nextStepDate, notes`). Stages: `Saved, Applied, Interviewing, Offer,
> Closed` (validated in `validateApplication`). React client in
> `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Activity log per application
**As a** job seeker, **I want** to log activities, **so that** I have a history per application.

### Acceptance criteria
- [ ] `GET/POST /api/applications/:id/activities` manage a timestamped note list.
- [ ] Activities are removed when the application is deleted.
- [ ] The client shows a timeline and an "Add note" box per application.

### Implementation plan
1. **`server/server.js`** - add an `activities = []` array of `{ id, applicationId, text, createdAt }`. Add `GET`/`POST` nested routes (POST requires non-empty `text`). In the application `DELETE`, also drop matching activities.
2. **`client/src/api.js`** - add `listActivities(id)` and `addActivity(id, text)`.
3. **`client/src/App.jsx`** - add an expandable timeline + input per card; load on expand and after adding.

### How to test
Add two activities, confirm newest-first timeline; delete the application and confirm its activities are gone.

---

## Story 2: Pipeline dashboard (counts per stage)
**As a** job seeker, **I want** a stage summary, **so that** I see my funnel.

### Acceptance criteria
- [ ] `GET /api/applications/summary` returns a count per stage.
- [ ] The client shows a row of stage cards with counts that update after changes.

### Implementation plan
1. **`server/server.js`** - add `app.get("/api/applications/summary", ...)` returning `stages.reduce((m,s)=>({...m,[s]: applications.filter(a=>a.stage===s).length}),{})`. (Define this route **before** `/api/applications/:id` if you add one, to avoid route shadowing.)
2. **`client/src/api.js`** - add `getSummary()`.
3. **`client/src/App.jsx`** - fetch the summary in the same effect as the list and render stage cards.

### How to test
Move applications between stages, confirm the dashboard counts update on refresh.

---

## Story 3: Highlight overdue next steps
**As a** job seeker, **I want** overdue follow-ups flagged, **so that** I don't miss them.

### Acceptance criteria
- [ ] An application whose `nextStepDate` is before today (and stage   Closed) shows a red "Overdue" tag.
- [ ] A "Show overdue only" filter narrows the list.

### Implementation plan
1. **`client/src/App.jsx`** - add a helper `isOverdue(app)` comparing `new Date(app.nextStepDate)` to today (guard empty dates) and `app.stage !== "Closed"`. Render the tag when true. (Pure client/derived - no server change needed.)
2. **`client/src/App.jsx`** - add an "Overdue only" checkbox that filters the rendered list with `isOverdue`.

### How to test
Set a past `nextStepDate`, confirm the red tag; "Overdue only" shows just those; a Closed app with a past date is not flagged.

---

## Story 4: Move stage via PATCH with valid transitions
**As a** job seeker, **I want** quick stage advancement, **so that** I update status fast.

### Acceptance criteria
- [ ] `PATCH /api/applications/:id/stage` sets a new stage, validated against the allowed list.
- [ ] The client has a stage dropdown on each card that calls it.
- [ ] An invalid stage returns 400.

### Implementation plan
1. **`server/server.js`** - add `app.patch("/api/applications/:id/stage", ...)`: validate `req.body.stage` against the `stages` array; 404 if app missing; else set and return it.
2. **`client/src/api.js`** - add `setStage(id, stage)`.
3. **`client/src/App.jsx`** - render a `<select>` per card bound to its stage that calls `setStage` then refreshes (and the dashboard from Story 2).

### How to test
Change an application's stage via the dropdown, confirm it persists and the dashboard updates; POST an invalid stage and confirm 400.

---

## Story 5: Sort by next-step date
**As a** job seeker, **I want** to sort by upcoming follow-up, **so that** I act on the soonest first.

### Acceptance criteria
- [ ] A "Sort" control offers Company (A-Z) and Next step (soonest first).
- [ ] Applications with no `nextStepDate` sort last under "Next step".

### Implementation plan
1. **`server/server.js`** - read `sort = "company"` in `GET /api/applications`; after filtering, sort: `company` -> `localeCompare`; `nextStep` -> empty dates go last, otherwise compare `new Date(a.nextStepDate) - new Date(b.nextStepDate)`.
2. **`client/src/App.jsx`** - add `sort` to `filters` and a `<select>`.

### How to test
Set different next-step dates (one empty), choose "Next step", confirm soonest leads and the empty one is last.

