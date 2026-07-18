# Support Tickets Codebase Guide

Support Tickets teaches two production patterns: many-to-many labels and an append-only audit log.

## Code Map

- `shared/types.ts`: ticket, agent, label, event contracts.
- `server/src/db.ts`: Postgres helper.
- `server/src/index.ts`: ticket routes, status/assignee mutations, events.
- `server/db/schema.sql`: tickets, labels, join table, event table.
- `client/src/api.ts`: typed API calls.
- `client/src/App.tsx`: filters, ticket creation, mutation controls.

## Many-to-Many Join Table

```sql
CREATE TABLE ticket_labels (
  ticket_id uuid REFERENCES tickets(id),
  label_id uuid REFERENCES labels(id),
  PRIMARY KEY (ticket_id, label_id)
);
```

Use a join table when both sides can have many of the other. This appears constantly: users/roles, products/tags, tickets/labels.

## JSON Aggregation

```sql
json_agg(l.*) FILTER (WHERE l.id IS NOT NULL) AS labels
```

The server turns many label rows into a `labels[]` array. This gives the frontend a convenient shape without losing relational structure.

## Append-Only Events

```ts
await query("INSERT INTO ticket_events (ticket_id, kind, body) VALUES ($1, $2, $3)", [...]);
```

Audit logs should be append-only. Do not edit history; add new events that explain what changed.

## Focused Mutation Endpoints

```ts
export function setStatus(id: string, status: TicketStatus) {
  return request<Ticket>(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
```

Focused endpoints make business actions explicit. They are easier to authorize and audit than one giant update route.

## Extension Practice

- Add comments as ticket events.
- Add SLA due dates.
- Add label editing.
- Add permission checks by agent.
- Add tests that every status change creates an event.

Support systems are accountability systems. Preserve history.
