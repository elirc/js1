# Insurance Claims

A C# / .NET 8 / Postgres medium-complexity CRUD study project for insurance claims, adjusters, claim types, reserve amounts, and decision workflow.

## Tech stack

- ASP.NET Core Minimal APIs
- Dapper for explicit SQL mapping
- Npgsql for Postgres connectivity
- PostgreSQL full-text search, constraints, indexes, and cascades
- Repository pattern with transaction boundaries

## API overview

- GET /api/claims lists claims with search, status filter, category filter, sorting, and pagination.
- GET /api/claims/stats returns totals grouped by status and category.
- GET /api/claims/{id} fetches one claim.
- POST /api/claims creates one claim and writes an activity entry in the same transaction.
- PUT /api/claims/{id} replaces editable fields.
- PATCH /api/claims/{id}/status changes workflow status and writes an activity entry.
- GET /api/claims/{id}/activity lists activity history.
- POST /api/claims/{id}/activity adds a note.
- DELETE /api/claims/{id} deletes a record and cascades activity rows.

## Local study setup

No packages are installed in this workspace. When you are ready to run it:

~~~bash
cd insurance-claims-dotnet
createdb insurance_claims_dotnet
psql insurance_claims_dotnet < db/schema.sql
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
