# Grant Manager Codebase Guide

This project is a full-stack TypeScript CRUD app: React on the client, Express on the server, and Postgres as the data store. It models grant applications, review stages, award amounts, and activity notes.

## Architecture

- shared/types.ts is the client/server API contract.
- server/db/schema.sql defines the relational data model and seed data.
- server/src/db.ts owns the Postgres pool and transaction helper.
- server/src/index.ts owns routes, validation, SQL queries, and response mapping.
- client/src/api.ts hides fetch details from React components.
- client/src/App.tsx owns UI state, forms, filters, pagination, and activity display.

## Important patterns

The server maps snake_case database rows into camelCase API objects, validates before mutation, and keeps list filtering/sorting/pagination on the server.

## Extension ideas

- Add owner filtering.
- Add CSV export for the current filter set.
- Add optimistic UI updates for status changes.
- Add database constraints for valid statuses and categories.
- Split App.tsx into smaller feature components.
