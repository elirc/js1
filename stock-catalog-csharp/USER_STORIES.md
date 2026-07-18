# Stock Catalog C# - User Stories

These stories are for the C# mirror implementation. The current project uses ASP.NET Core Minimal APIs: Program.cs maps endpoints, Models.cs defines Product records/request DTOs/validation, and Repository.cs owns in-memory CRUD. Each story is scoped so a junior SWE can implement it one file at a time.

## Story 1: Persist Product records to a JSON file
**As a** user, **I want** data to survive app restarts, **so that** the API behaves like a real service.

### Detailed requirements
- Load records from Data/Product.json when the app starts.
- If the file is missing, use the current seed records and create the file after the first mutation.
- Create, update, and delete write the full list back to disk.
- Bad JSON should fail loudly with a useful exception instead of silently wiping data.

### Detailed implementation plan
1. In Repository.cs, add using System.Text.Json; if needed.
2. Add fields: private readonly string _filePath; and optionally private readonly object _lock = new();.
3. Add a repository constructor accepting IWebHostEnvironment env; set _filePath = Path.Combine(env.ContentRootPath, "Data", "Product.json").
4. Move the current seed list into private static List<Product> Seed().
5. In the constructor, call Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!), then load existing JSON when present; otherwise use Seed().
6. Add private void Persist() that calls File.WriteAllText(_filePath, JsonSerializer.Serialize(_items, new JsonSerializerOptions { WriteIndented = true })).
7. Call Persist() after successful Create, Update, and Delete mutations.
8. Manual test: create one record with POST /api/products, stop/restart the API, then confirm GET /api/products still returns it.

## Story 2: Add pagination and sorting to GET /api/products
**As a** user, **I want** paging and sorting, **so that** large lists stay usable.

### Detailed requirements
- Accept page, pageSize, sort, and dir query parameters.
- Return { items, total, page, pageSize, totalPages } instead of a raw array.
- Clamp pageSize between 1 and 50 and force page >= 1.
- Unsupported sort fields fall back to a safe default.

### Detailed implementation plan
1. In Models.cs, add public sealed record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize, int TotalPages);.
2. In Repository.cs, replace or supplement List(...) with Query(string? search, string? filter, int page, int pageSize, string? sort, string? dir).
3. Inside Query, apply operations in this order: filter first, sort second, Skip/Take last.
4. Implement sorting with a switch expression. Start with Id plus one obvious text field from Product.
5. Compute total before paging and totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)).
6. In Program.cs, update the list endpoint to accept the new query params and return Results.Ok(repository.Query(...)).
7. Manual test: request ?page=1&pageSize=1, then ?page=2&pageSize=1, and confirm different records are returned.

## Story 3: Strengthen validation rules
**As a** maintainer, **I want** invalid requests rejected consistently, **so that** the repository only stores clean Product data.

### Detailed requirements
- Required strings reject null, empty, and whitespace-only values.
- Numeric fields reject impossible values such as negative quantities, prices, durations, or counts.
- Date/time ranges, if present, must be logical.
- Both POST and PUT use the exact same validation path.

### Detailed implementation plan
1. Open Models.cs and find ProductRules.Validate.
2. Add one rule at a time using readable early returns: if (...) return "Message";.
3. For status-like fields, add an allowed-values array and validate against it case-insensitively.
4. For numeric fields, set explicit lower and upper bounds based on the domain.
5. Confirm Program.cs calls ProductRules.Validate(request) before repository mutation in both create and update endpoints.
6. Add manual test requests for each rule and confirm invalid requests return HTTP 400 with ApiError.

## Story 4: Add an audit trail
**As a** support engineer, **I want** to see changes for a record, **so that** I can debug user reports.

### Detailed requirements
- Every create, update, and delete writes an audit event.
- Audit events have Id, EntityId, Action, OccurredAt, and Summary.
- Add GET /api/products/{id}/audit to list events for a record.
- Audit remains available even after the record is deleted.

### Detailed implementation plan
1. In Models.cs, add public sealed record AuditEvent(Guid Id, Guid EntityId, string Action, DateTime OccurredAt, string Summary);.
2. In Repository.cs, add private readonly List<AuditEvent> _audit = new();.
3. Add helper RecordAudit(Guid entityId, string action, string summary).
4. Call it at the end of Create, Update, and Delete.
5. Add public IReadOnlyList<AuditEvent> ListAudit(Guid entityId) ordered newest first.
6. In Program.cs, add pp.MapGet($"{route}/{{id:guid}}/audit", ...) returning audit events.
7. Manual test: create, update, delete, then call the audit endpoint and confirm three events exist.

## Story 5: Add repository tests
**As a** junior SWE, **I want** tests around core behavior, **so that** I can refactor safely.

### Detailed requirements
- Tests cover create, update, delete, filtering, and validation.
- Tests do not require manually running the web server.
- Test names describe behavior, such as Create_AddsRecord.

### Detailed implementation plan
1. When ready to run .NET locally, create a sibling xUnit project named stock-catalog-csharp.Tests.
2. Reference this API project from the test project.
3. Add a test-friendly repository constructor accepting a seed list or temp file path.
4. Write a create test: build a ProductRequest, call Create, then assert Get(created.Id) returns a record.
5. Write an update test: create, update one field, then assert the changed value is present.
6. Write a delete test: create, delete, then assert Get(id) returns null.
7. Test validation directly by calling ProductRules.Validate with bad requests.



