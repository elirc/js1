# Campaign Planner - User Stories

These five stories extend the current React + Express CRUD app. Each plan is intentionally specific so a junior SWE can implement the feature by following the files and steps.

## Story 1: Persist Campaign data to disk
**As a** user, **I want** records to survive API restarts, **so that** the app behaves more like a real internal tool.

### Detailed requirements
- Store records and activity entries in server/data/campaigns.json.
- Seed the file from the current sample records when it does not exist.
- Create, update, status change, delete, and activity creation all persist immediately.
- Bad JSON should produce a clear server startup error.

### Detailed implementation plan
1. In server/server.js, import eadFile, writeFile, and mkdir from 
ode:fs/promises and join from 
ode:path.
2. Add constants for DATA_DIR and DATA_FILE near the top of the file.
3. Change createRepository() into sync createRepository() or add an async loadData() called before routes are registered.
4. Store both arrays in the file: { "items": [...], "activity": [...] }.
5. Add a persist() helper inside the repository that writes both arrays with JSON.stringify(data, null, 2).
6. Call persist() after every successful mutation.
7. Add server/data/ to .gitignore if you create one.

## Story 2: Add owner-based filtering
**As a** manager, **I want** to filter by owner, **so that** I can review one person's workload.

### Detailed requirements
- GET /api/campaigns?owner= returns only records assigned to that owner.
- Owner filtering combines with search, status, and category filters.
- The client owner dropdown is populated from existing records.

### Detailed implementation plan
1. In 
ormalizeQuery, add owner: String(query.owner || "all").
2. In epository.query, add const matchesOwner = owner === "all" || item.owner === owner.
3. Include matchesOwner in the return condition.
4. Add a repository method owners() or include owner options in the stats response.
5. In client/src/App.jsx, add owner: "all" to query state and render an Owner dropdown.
6. Reset page to 1 when owner changes by using the existing patchQuery helper.

## Story 3: Add bulk status updates
**As a** power user, **I want** to update several records at once, **so that** queue cleanup is faster.

### Detailed requirements
- Users can select multiple records in the list.
- PATCH /api/campaigns/bulk-status accepts { ids, status }.
- Invalid status returns 400.
- Response includes { updatedCount }.

### Detailed implementation plan
1. In server/server.js, add a route before /:id routes: pp.patch("/api/campaigns/bulk-status", ...).
2. Validate that ids is an array and status is in STATUSES.
3. Add repository method ulkSetStatus(ids, status) that updates matching records and writes one activity entry per changed record.
4. Return the number of changed records.
5. In client/src/App.jsx, add selectedIds state as a Set or array.
6. Add checkboxes to cards and a bulk action toolbar when selected count is greater than zero.
7. Call the new endpoint, clear selected ids, and refresh the list.

## Story 4: Add due-date alerts
**As a** user, **I want** overdue and due-soon records highlighted, **so that** I know what needs attention.

### Detailed requirements
- Records with due dates before today show Overdue.
- Records due within 3 days show Due soon.
- Closed/completed-style statuses should not show alerts.
- Alerts appear on cards and are included in stats.

### Detailed implementation plan
1. Add helper dueState(item) in client/src/App.jsx that returns overdue, soon, or ok.
2. Compare dates by creating local midnight dates from item.dueDate + "T00:00:00".
3. Add a closedStatuses array near STATUSES for statuses that should suppress alerts.
4. Render a badge in each card when due state is not ok.
5. Add CSS classes .badge.overdue and .badge.soon in styles.css.
6. Optionally add server-side counts in stats() by applying the same due-date logic.

## Story 5: Export filtered records as CSV
**As a** user, **I want** to export the current filtered view, **so that** I can share it with teammates.

### Detailed requirements
- Add GET /api/campaigns/export.csv.
- Export respects search, status, category, and owner filters.
- CSV includes a header row and escapes commas/quotes correctly.
- Client has an Export button in the toolbar.

### Detailed implementation plan
1. Add the export route before /:id routes in server/server.js.
2. Reuse 
ormalizeQuery(req.query) and repository filtering, but skip pagination.
3. Write a small csvEscape(value) helper: quote fields containing commas, quotes, or line breaks, and double any quotes inside.
4. Set response headers: Content-Type: text/csv and Content-Disposition: attachment; filename="campaigns.csv".
5. In client/src/App.jsx, add an Export button that builds a query string from current filters and opens the export URL.
6. Manually compare exported rows with the visible filtered records.
