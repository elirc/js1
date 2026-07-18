# Content Calendar

A C# / .NET 8 / Postgres medium-complexity CRUD study project for marketing content items, owners, channels, campaign budgets, and publishing workflow.

## Tech stack

- ASP.NET Core Minimal APIs
- Dapper for explicit SQL mapping
- Npgsql for Postgres connectivity
- PostgreSQL full-text search, constraints, indexes, and cascades
- Repository pattern with transaction boundaries

## API overview

- GET /api/content-items lists content items with search, status filter, category filter, sorting, and pagination.
- GET /api/content-items/stats returns totals grouped by status and category.
- GET /api/content-items/{id} fetches one content item.
- POST /api/content-items creates one content item and writes an activity entry in the same transaction.
- PUT /api/content-items/{id} replaces editable fields.
- PATCH /api/content-items/{id}/status changes workflow status and writes an activity entry.
- GET /api/content-items/{id}/activity lists activity history.
- POST /api/content-items/{id}/activity adds a note.
- DELETE /api/content-items/{id} deletes a record and cascades activity rows.

## Local study setup

No packages are installed in this workspace. When you are ready to run it:

~~~bash
cd content-calendar-dotnet
createdb content_calendar_dotnet
psql content_calendar_dotnet < db/schema.sql
dotnet restore
dotnet run
~~~

Use '.env.example' or 'appsettings.Development.json' as the shape for the database connection string.

## What this project is designed to teach

- How a route group exposes a focused HTTP API.
- How request DTOs protect your domain from arbitrary JSON.
- How validation happens before database writes.
- How Dapper keeps SQL visible instead of hiding it behind an ORM.
- How Postgres constraints duplicate important business rules at the storage layer.
- How transactions keep a primary record and its activity log consistent.
- How pagination, sorting, and filtering are implemented safely.
