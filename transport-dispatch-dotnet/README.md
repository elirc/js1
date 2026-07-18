# Transport Dispatch

A C# / .NET 8 / Postgres medium-complexity CRUD study project for transport dispatches, coordinators, route types, trip costs, and delivery status.

## Tech stack

- ASP.NET Core Minimal APIs
- Dapper for explicit SQL mapping
- Npgsql for Postgres connectivity
- PostgreSQL full-text search, constraints, indexes, and cascades
- Repository pattern with transaction boundaries

## API overview

- GET /api/dispatches lists dispatches with search, status filter, category filter, sorting, and pagination.
- GET /api/dispatches/stats returns totals grouped by status and category.
- GET /api/dispatches/{id} fetches one dispatch.
- POST /api/dispatches creates one dispatch and writes an activity entry in the same transaction.
- PUT /api/dispatches/{id} replaces editable fields.
- PATCH /api/dispatches/{id}/status changes workflow status and writes an activity entry.
- GET /api/dispatches/{id}/activity lists activity history.
- POST /api/dispatches/{id}/activity adds a note.
- DELETE /api/dispatches/{id} deletes a record and cascades activity rows.

## Local study setup

No packages are installed in this workspace. When you are ready to run it:

~~~bash
cd transport-dispatch-dotnet
createdb transport_dispatch_dotnet
psql transport_dispatch_dotnet < db/schema.sql
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
