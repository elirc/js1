# Content Calendar User Stories

Each story is written with enough requirements and implementation detail that a junior SWE can implement it as a focused codebase exercise.

## Story 1: Add owner filtering

**As a** team lead, **I want** to filter content items by owner, **so that** I can review one person's workload.

### Detailed requirements

- 'GET /api/content-items?owner=...' filters by exact owner.
- 'owner=all' or missing owner returns all owners.
- Owner filtering combines with search, status, category, sorting, and pagination.
- Add a lightweight endpoint 'GET /api/content-items/owners' that returns distinct owners in alphabetical order.

### Detailed implementation plan

1. Add 'Owner' to 'QueryOptions' in 'Models.cs' with default value 'all'.
2. Update 'QueryOptions.From' to read the 'owner' query string value.
3. Update the repository 'whereClause' with 'AND (@Owner = ''all'' OR owner = @Owner)'.
4. Add 'Owner = options.Owner' to the anonymous parameters object.
5. Add 'ListOwnersAsync' to 'ItemRepository'.
6. Add 'group.MapGet("/owners", ...)' in 'Program.cs'.
7. Manually test combinations: only owner, owner plus status, owner plus search, and owner plus pagination.

## Story 2: Convert hard delete into soft delete

**As an** admin, **I want** deleted content items archived, **so that** accidental deletes can be recovered.

### Detailed requirements

- Add nullable 'deleted_at timestamptz' to 'work_items'.
- Normal list/detail endpoints hide deleted rows.
- 'DELETE /api/content-items/{id}' sets 'deleted_at = now()' instead of deleting.
- Add 'POST /api/content-items/{id}/restore'.
- Add 'includeDeleted=true' support for list endpoints.
- Activity rows must remain available for restored records.

### Detailed implementation plan

1. Update 'db/schema.sql' with 'deleted_at timestamptz'.
2. Remove 'ON DELETE CASCADE' from 'activity_entries' if you want long-term activity retention.
3. Update list and detail SQL to include 'deleted_at IS NULL' unless 'includeDeleted' is true.
4. Change 'DeleteAsync' into an update statement that returns whether a row changed.
5. Add 'RestoreAsync(Guid id)' to clear 'deleted_at'.
6. Add a restore endpoint in 'Program.cs'.
7. Add an activity entry when a record is archived and when it is restored.

## Story 3: Add status history

**As an** auditor, **I want** status changes stored separately, **so that** I can see workflow movement over time.

### Detailed requirements

- Create a 'status_history' table with 'item_id', 'from_status', 'to_status', and 'created_at'.
- Every status change writes exactly one status history row.
- Add 'GET /api/content-items/{id}/status-history'.
- The endpoint returns newest status changes first.

### Detailed implementation plan

1. Add the 'status_history' table in 'db/schema.sql'.
2. In 'ChangeStatusAsync', load the existing row before updating.
3. If the row does not exist, return 'null' as the method does today.
4. If the status is unchanged, decide whether to return validation error or no-op. Document the choice.
5. Inside the existing transaction, update 'work_items', insert 'activity_entries', and insert 'status_history'.
6. Add a 'StatusHistoryEntry' record to 'Models.cs'.
7. Add 'ListStatusHistoryAsync' to the repository.
8. Map the new GET endpoint in 'Program.cs'.

## Story 4: Add CSV export for filtered records

**As a** manager, **I want** to export filtered content items, **so that** I can share a report outside the app.

### Detailed requirements

- Add 'GET /api/content-items/export.csv'.
- Export respects search, status, category, owner, and deleted filters.
- Export ignores pagination.
- CSV includes headers: 'Title', 'Owner', 'Category', 'Status', 'Amount', 'Priority', 'DueDate'.
- Values containing quotes, commas, or newlines are escaped correctly.

### Detailed implementation plan

1. Add a repository method 'ListForExportAsync(QueryOptions options)'.
2. Reuse the same filter-building approach as 'ListAsync', but omit 'LIMIT' and 'OFFSET'.
3. Add a local 'CsvEscape' helper in 'Program.cs' or a small 'CsvWriter' class.
4. Map '/export.csv' before '/{id:guid}' so routing remains unambiguous.
5. Set 'Content-Type' to 'text/csv'.
6. Set 'Content-Disposition' to suggest a file name like 'content-calendar-dotnet.csv'.
7. Test records with commas and quotes in notes or titles.

## Story 5: Add integration tests

**As a** junior SWE, **I want** integration tests around the API, **so that** I can refactor repository code safely.

### Detailed requirements

- Tests cover list, create, update, status change, activity creation, stats, and delete.
- Tests use a separate Postgres database.
- Each test starts from known seed data.
- Tests assert both HTTP status codes and persisted database state.

### Detailed implementation plan

1. Add a test project such as 'ContentCalendarDotnet.Tests'.
2. Reference the API project from the test project.
3. Extract app creation from 'Program.cs' into a testable factory if needed.
4. Use a test connection string such as 'ConnectionStrings__Default'.
5. Run 'db/schema.sql' before each test class or test collection.
6. Write a create test that posts JSON and then queries the database for the inserted row.
7. Write a status test that verifies both 'work_items.status' and the activity log row.
8. Keep tests independent; never depend on another test's created data.
