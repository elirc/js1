# Vendor Contracts - User Stories

These stories extend the TypeScript + React + Node + Postgres implementation. Each includes detailed requirements and an implementation plan for a junior SWE.

## Story 1: Add owner filtering
**As a** manager, **I want** to filter by owner, **so that** I can review one person's workload.

### Detailed requirements
- GET /api/contracts?owner= filters records by exact owner.
- Owner filtering combines with search, status, and category.
- The client renders an owner dropdown populated from existing records.

### Detailed implementation plan
1. In server/src/index.ts, update parseQuery to return owner with default `all`.
2. Add AND ($4 = 'all' OR owner = $4) to the list SQL and shift later SQL parameters by one.
3. Add GET /api/contracts/owners returning distinct owners sorted alphabetically.
4. In client/src/api.ts, add listOwners().
5. In client/src/App.tsx, add owner: "all" to query state and render a dropdown.
6. Reset page to 1 when owner changes.

## Story 2: Add database-backed status history
**As a** user, **I want** status changes recorded, **so that** I can audit workflow movement.

### Detailed requirements
- Create a status_history table.
- Every PATCH /status writes old status, new status, and timestamp.
- Add GET /api/contracts/:id/status-history.

### Detailed implementation plan
1. Add status_history table in server/db/schema.sql with item_id, `from_status`, `to_status`, and created_at.
2. In the status route, load the existing item first.
3. Use withTransaction to update item status and insert history together.
4. Add StatusHistoryEntry to shared/types.ts.
5. Add listStatusHistory(id) in client/src/api.ts.
6. Render status history in the activity panel below regular activity notes.

## Story 3: Add CSV export
**As a** user, **I want** to export filtered records, **so that** I can share them outside the app.

### Detailed requirements
- GET /api/contracts/export.csv exports records matching current filters.
- Export ignores pagination but respects search/status/category/owner.
- CSV includes a header row and escapes quotes and commas.

### Detailed implementation plan
1. Add the export route before /:id routes in server/src/index.ts.
2. Reuse the same WHERE filters as the list route but omit LIMIT/OFFSET.
3. Add csvEscape(value) helper.
4. Set Content-Type: text/csv and Content-Disposition: attachment headers.
5. Add an Export button in App.tsx that builds a URL from current query state.
6. Compare exported rows to the visible filtered data.

## Story 4: Add soft delete
**As an** admin, **I want** deleted records archived, **so that** mistakes can be recovered.

### Detailed requirements
- Add deleted_at to items.
- List endpoints hide deleted rows by default.
- DELETE sets deleted_at instead of removing the row.
- Add POST /api/contracts/:id/restore.

### Detailed implementation plan
1. Add nullable deleted_at timestamptz to items in schema.
2. Update list and detail queries to include deleted_at IS NULL unless includeDeleted=true.
3. Change delete route to UPDATE items SET deleted_at=now().
4. Add restore route that sets deleted_at=NULL.
5. Add API helper `restoreItem(id)`.
6. Add a Show archived toggle and Restore button in the UI.

## Story 5: Add integration tests for API routes
**As a** junior SWE, **I want** route tests, **so that** I can change SQL safely.

### Detailed requirements
- Tests cover list, create, update, status change, activity creation, and delete.
- Tests use a separate test database.
- Each test starts from known seed data.

### Detailed implementation plan
1. Add a test script later using your preferred test runner, such as Vitest plus Supertest.
2. Create .env.test with a test DATABASE_URL.
3. Before tests, run server/db/schema.sql against the test database.
4. Export `app` from server/src/index.ts separately from `app.listen` so tests can call it.
5. Write one test per endpoint using HTTP requests.
6. Assert both response status and database side effects.
