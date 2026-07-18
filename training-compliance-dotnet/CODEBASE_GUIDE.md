# Training Compliance Codebase Guide

This guide is written for a junior software engineer practicing how to enter a larger corporate codebase. The project is intentionally small, but it uses patterns you will see in production: route registration, request DTOs, validation, repository classes, SQL queries, database constraints, and audit-style activity rows.

## Folder tour

- 'TrainingComplianceDotnet.csproj' declares the .NET target and NuGet packages.
- 'Program.cs' wires dependency injection and maps HTTP endpoints.
- 'Models.cs' defines API response models, request DTOs, query parsing, and validation rules.
- 'Repositories/ItemRepository.cs' owns all SQL and transaction boundaries.
- 'db/schema.sql' creates Postgres tables, constraints, indexes, and seed data.
- 'README.md' gives quick setup and API reference.
- 'USER_STORIES.md' contains implementation-ready feature work.

## Request flow

The route layer is deliberately thin. It reads request data, asks the domain rules to validate it, calls the repository, and converts the result into an HTTP response.

~~~csharp
group.MapPost("/", async (CreateItemRequest request, ItemRepository repo) =>
{
    var errors = DomainRules.Validate(request);
    if (errors.Count > 0) return Results.BadRequest(new ApiError("ValidationFailed", string.Join(" ", errors)));

    var created = await repo.CreateAsync(request);
    return Results.Created($"/api/assignments/{created.Id}", created);
});
~~~

Why this matters:

- The endpoint does not know SQL.
- The endpoint does not trust client input.
- The response shape is consistent.
- The repository can be tested separately from HTTP routing.

## DTOs versus domain responses

'CreateItemRequest' and 'UpdateItemRequest' represent what clients are allowed to send. 'WorkItem' represents what the API returns after Postgres has assigned IDs and timestamps.

~~~csharp
public sealed record CreateItemRequest(
    string Title,
    string Owner,
    string Category,
    string Status,
    decimal Amount,
    string Priority,
    DateOnly? DueDate,
    string Notes);
~~~

In larger codebases, this split prevents clients from setting fields like 'Id', 'CreatedAt', or 'UpdatedAt' directly.

## Validation

The route calls 'DomainRules.Validate' before any mutation reaches the database.

~~~csharp
if (!Statuses.Contains(status))
{
    return Results.BadRequest(new ApiError("ValidationFailed", "Choose a valid status."));
}
~~~

Application validation gives users helpful error messages. Database constraints still exist because production systems need defense in depth.

## Query parsing

List endpoints often grow more complicated than create endpoints. This project moves query parsing into 'QueryOptions.From'.

~~~csharp
var page = int.TryParse(Read(query, "page", "1"), out var parsedPage)
    ? Math.Max(1, parsedPage)
    : 1;
var pageSize = int.TryParse(Read(query, "pageSize", "10"), out var parsedSize)
    ? Math.Clamp(parsedSize, 1, 50)
    : 10;
~~~

Notice the guardrails:

- Page numbers cannot go below 1.
- Page size is capped at 50.
- Missing values get predictable defaults.

## Repository pattern

'ItemRepository' is the only class that talks to Postgres. That makes database behavior discoverable.

~~~csharp
public sealed class ItemRepository
{
    private readonly NpgsqlDataSource _dataSource;

    public ItemRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }
}
~~~

In larger codebases, repository classes can become too large. When that happens, split by aggregate or workflow, not by random helper methods.

## Safe sorting

SQL parameters cannot parameterize column names, so user-provided sort keys must map through a whitelist.

~~~csharp
private static readonly IReadOnlyDictionary<string, string> SortColumns = new Dictionary<string, string>
{
    ["title"] = "title",
    ["owner"] = "owner",
    ["createdAt"] = "created_at"
};
~~~

This avoids string-concatenating arbitrary client input into SQL.

## Filtering and pagination

The list query combines full-text search, exact filters, sorting, and pagination.

~~~csharp
const string whereClause = """
    WHERE (@Search = '' OR search_vector @@ websearch_to_tsquery('english', @Search))
      AND (@Status = 'all' OR status = @Status)
      AND (@Category = 'all' OR category = @Category)
    """;
~~~

The code runs a count query and a page query. This mirrors real APIs where the UI needs both current rows and total pages.

## Transaction boundary

Create and update operations write both the main record and an activity row. Those writes must succeed or fail together.

~~~csharp
await using var transaction = await connection.BeginTransactionAsync();

var created = await connection.QuerySingleAsync<WorkItem>(insertSql, request, transaction);
await connection.ExecuteAsync(activitySql, new { ItemId = created.Id, Body = $"Created {created.Title}" }, transaction);

await transaction.CommitAsync();
~~~

Without the transaction, a production outage could leave a assignment without its audit trail or an audit trail without the matching record.

## Database design

The schema repeats business rules with constraints.

~~~sql
category text NOT NULL CHECK (category IN ('Security', 'HR', 'Safety', 'Privacy')),
status text NOT NULL CHECK (status IN ('Assigned', 'In Progress', 'Overdue', 'Completed', 'Waived')),
amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
~~~

This is a corporate SWE habit: never rely only on frontend validation or route validation for data integrity.

## Activity log

The activity table is a simple child table with cascade delete.

~~~sql
item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE
~~~

That means deleting a assignment also removes its activity rows. A later user story asks you to replace this with soft delete, which is common in corporate systems.

## How to approach changes

When adding a field, trace it through this order:

1. 'db/schema.sql'
2. 'Models.cs'
3. 'Repositories/ItemRepository.cs'
4. 'Program.cs' validation or route behavior
5. README and API examples
6. Tests, if you add them

That tracing skill is one of the biggest differences between toy CRUD work and real codebase work.
