# Customer Success Plans

A C# / .NET 8 / Postgres medium-complexity CRUD study project for customer success plans, CSM owners, account segments, renewal value, and health workflow.

## Tech stack

- ASP.NET Core Minimal APIs
- Dapper for explicit SQL mapping
- Npgsql for Postgres connectivity
- PostgreSQL full-text search, constraints, indexes, and cascades
- Repository pattern with transaction boundaries

## API overview

- GET /api/plans lists plans with search, status filter, category filter, sorting, and pagination.
- GET /api/plans/stats returns totals grouped by status and category.
- GET /api/plans/{id} fetches one plan.
- POST /api/plans creates one plan and writes an activity entry in the same transaction.
- PUT /api/plans/{id} replaces editable fields.
- PATCH /api/plans/{id}/status changes workflow status and writes an activity entry.
- GET /api/plans/{id}/activity lists activity history.
- POST /api/plans/{id}/activity adds a note.
- DELETE /api/plans/{id} deletes a record and cascades activity rows.

## Local study setup

No packages are installed in this workspace. When you are ready to run it:

~~~bash
cd customer-success-plans-dotnet
createdb customer_success_plans_dotnet
psql customer_success_plans_dotnet < db/schema.sql
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
