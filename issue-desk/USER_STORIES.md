# Issue Desk - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4101**) uses a
> `createIssueRepository()` with `list/find/create/update/remove` and a
> `validateIssue` middleware. Issue fields: `id, title, status, priority,
> assignee, description, createdAt`. The React client (`client/src/App.jsx`)
> talks to it via `client/src/api.js` (`listIssues/createIssue/updateIssue/
> deleteIssue`). Data is in-memory and resets on restart.

---

## Story 1: Add an "estimate" field
**As a** team lead, **I want** a story-point estimate, **so that** I can plan capacity.

### Acceptance criteria
- [ ] Issues store a numeric `estimate` (0-13); it's shown on each card.
- [ ] Create and edit both round-trip the value.
- [ ] Invalid estimates are rejected with a 400.

### Implementation plan
1. **`server/server.js`** - in `validateIssue`, add `const e = Number(estimate)` and reject if `!Number.isInteger(e) || e < 0 || e > 13`.
2. **`server/server.js`** - in repository `create` and `update`, set `estimate: Number(input.estimate) || 0`. Add `estimate` to the seed issues.
3. **`client/src/App.jsx`** - add `estimate: 0` to `emptyForm`; add a number input bound to `form.estimate`; in `startEdit` copy `issue.estimate`; render it on the card.
4. **`client/src/api.js`** - no change (the whole `form`/`issue` object is sent).

### How to test
Create an issue with estimate 5, confirm it shows and survives an edit; submit `estimate: 99` and confirm a 400 with the error message.

---

## Story 2: Filter by priority
**As a** user, **I want** to filter by priority, **so that** I can triage criticals first.

### Acceptance criteria
- [ ] A priority dropdown ("all" + each level) narrows the list server-side.
- [ ] It combines with the existing status filter and search.

### Implementation plan
1. **`server/server.js`** - in `GET /api/issues`, read `priority = "all"` from `req.query`; in `repository.list`, add `const matchesPriority = priority === "all" || issue.priority === priority` to the filter.
2. **`client/src/api.js`** - `listIssues(filters)` already serializes the whole `filters` object via `URLSearchParams`, so no change needed.
3. **`client/src/App.jsx`** - add `priority: "all"` to the `filters` state; add a `<select>` bound to it; the existing `useEffect([filters])` refetches automatically.

### How to test
Create issues of mixed priority, choose "Critical", confirm only those load; combine with a status filter and a search term.

---

## Story 3: Server-side sorting
**As a** user, **I want** to sort the list, **so that** I can order by priority or recency.

### Acceptance criteria
- [ ] A "Sort" control offers Newest, Priority (Critical->Low).
- [ ] Sorting happens on the server and respects active filters.

### Implementation plan
1. **`server/server.js`** - read `sort = "created"` in `GET`; in `repository.list`, after filtering, sort the array: `created` -> by `createdAt` descending; `priority` -> map `{Critical:0,High:1,Medium:2,Low:3}` and compare.
2. **`client/src/App.jsx`** - add `sort: "created"` to `filters` and a `<select>` to change it.

### How to test
Set sort to Priority, confirm Critical issues lead regardless of insertion order; switching filters keeps the sort.

---

## Story 4: Comments as a nested resource
**As a** user, **I want** to comment on an issue, **so that** I can record discussion.

### Acceptance criteria
- [ ] `GET /api/issues/:id/comments` and `POST /api/issues/:id/comments` exist.
- [ ] Comments belong to an issue and are removed when the issue is deleted.
- [ ] The client can expand an issue to read and add comments.

### Implementation plan
1. **`server/server.js`** - in the repository, add a `comments = []` array of `{ id, issueId, author, body, createdAt }`. Add methods `listComments(issueId)`, `addComment(issueId, input)`, and update `remove(id)` to also drop `comments` for that issue.
2. **`server/server.js`** - add routes `GET /api/issues/:id/comments` (404 if issue missing) and `POST /api/issues/:id/comments` with a small validation (author + body required).
3. **`client/src/api.js`** - add `listComments(id)` and `addComment(id, comment)` following the existing `request()` helper.
4. **`client/src/App.jsx`** - add an expandable comments section per card with a tiny comment form; load comments on expand.

### How to test
Add two comments to an issue, reload them, then delete the issue and confirm a fresh `GET .../comments` 404s (issue gone) and no orphan comments remain.

---

## Story 5: Persist to a JSON file
**As a** user, **I want** my issues to survive a restart, **so that** I don't lose work.

### Acceptance criteria
- [ ] Issues are written to `server/data/issues.json` on every mutation.
- [ ] On boot the repository loads from that file (seeding it if missing).
- [ ] Restarting the server preserves all data.

### Implementation plan
1. **`server/server.js`** - import `readFile, writeFile, mkdir` from `node:fs/promises` and `dirname/join` from `node:path` (see the sibling `note-vault` project for the exact pattern).
2. **`server/server.js`** - make the repository hold its array but call a `persist()` after each mutation that writes `JSON.stringify(issues, null, 2)` to the data file; on startup, read+parse the file or seed it (catch `ENOENT`).
3. Make `create/update/remove` `async` (they already run synchronously today; wrap the writes) and `await` them in the routes, or keep the array in memory and just mirror to disk after each change.
4. **`.gitignore`** (create if absent) - add `server/data/`.

### How to test
Create an issue, stop the server, restart it, confirm the issue is still listed; delete `issues.json` and confirm it re-seeds on next boot.

