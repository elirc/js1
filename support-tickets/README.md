# Support Tickets (TypeScript · React · Node · Postgres)

A help-desk app whose lesson is **many-to-many relationships** plus an
**append-only audit log**. A ticket can carry many labels, a label belongs to
many tickets, and every change is recorded as an event.

## What it teaches

- A join table (`ticket_labels`) with a composite primary key
- Aggregating the related rows back into JSON with
  `json_agg(... ) FILTER (WHERE ...)` so each ticket arrives with a `labels[]`
- Filtering by a joined label with `EXISTS (SELECT 1 FROM ticket_labels ...)`
- `ON DELETE SET NULL` for the optional assignee vs. `ON DELETE CASCADE` for
  child rows
- Writing the ticket, its label links, and an audit event in one transaction
- An immutable `ticket_events` history you can replay per ticket

## Schema

```
agents ──< tickets >──< ticket_labels >──< labels
                │
                └──< ticket_events   (audit log)
```

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb support_tickets
npm install
npm run db:setup
npm run dev          # API on :4111, client on :5111
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## Stretch ideas

- Add `GET /api/labels` counts (`COUNT(*)` per label via the join table).
- Add SLA timers using the `created_at` / `updated_at` columns.
- Record *who* made each change by adding an `actor_id` to `ticket_events`.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): row locks, atomic updates and meaningful audit events, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
