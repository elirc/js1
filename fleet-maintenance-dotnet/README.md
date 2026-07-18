# Fleet Maintenance

A C# / .NET 8 / Postgres medium-complexity CRUD study project for vehicle maintenance work orders, mechanics, service categories, costs, and repair status.

## Tech stack

- ASP.NET Core Minimal APIs
- Dapper for explicit SQL mapping
- Npgsql for Postgres connectivity
- PostgreSQL full-text search, constraints, indexes, and cascades
- Repository pattern with transaction boundaries

## API overview

- GET /api/work-orders lists work orders with search, status filter, category filter, sorting, and pagination.
- GET /api/work-orders/stats returns totals grouped by status and category.
- GET /api/work-orders/{id} fetches one work order.
- POST /api/work-orders creates one work order and writes an activity entry in the same transaction.
- PUT /api/work-orders/{id} replaces editable fields.
- PATCH /api/work-orders/{id}/status changes workflow status and writes an activity entry.
- GET /api/work-orders/{id}/activity lists activity history.
- POST /api/work-orders/{id}/activity adds a note.
- DELETE /api/work-orders/{id} deletes a record and cascades activity rows.

## Local study setup

No packages are installed in this workspace. When you are ready to run it:

~~~bash
cd fleet-maintenance-dotnet
createdb fleet_maintenance_dotnet
psql fleet_maintenance_dotnet < db/schema.sql
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
