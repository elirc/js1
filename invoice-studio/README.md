# Invoice Studio (TypeScript · React · Node · Postgres)

A typed full-stack invoicing app. The headline lesson is **database
transactions**: an invoice and its line items are written atomically, and money
totals are computed in SQL rather than trusted from the client.

## What it teaches

- A shared `shared/types.ts` used by **both** the server and the client
- `pg.Pool` connection pooling and parameterised queries (`$1`, `$2`)
- A `withTransaction` helper (`BEGIN` / `COMMIT` / `ROLLBACK`)
- Aggregating totals with `SUM(...)`, `LEFT JOIN`, and `COALESCE`
- A status state machine guarded by a `CHECK` constraint
- Centralised Express error handling that maps validation errors to `400`

## Schema

```
clients ──< invoices ──< invoice_items
```

`invoice_items.invoice_id` and `invoices.client_id` use
`ON DELETE CASCADE`, so removing a client (or invoice) cleans up its children.

## Run it (you provide Postgres)

```bash
cp .env.example .env            # point DATABASE_URL at your database
createdb invoice_studio         # or use an existing database
npm install
npm run db:setup                # loads server/db/schema.sql (+ seed data)
npm run dev                     # API on :4110, Vite client on :5110
```

> These projects are **study scaffolds** — no dependencies are committed.
> `npm run db:setup` shells out to `psql`, so it expects the Postgres client
> tools on your PATH.

## Stretch ideas

- Add a `PUT` form in the UI (the server already supports editing).
- Add a `paid_at` timestamp set when status moves to `paid`.
- Add a monthly revenue report with `date_trunc('month', issued_date)`.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): decimal input contracts and transactional parent/child writes, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
