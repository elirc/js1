# Invoice Studio Codebase Guide

Invoice Studio teaches transactional writes and SQL-derived totals. This is close to real business software: invoices, line items, totals, and statuses.

## Code Map

- `shared/types.ts`: customer, invoice, line item, and API types.
- `server/src/db.ts`: Postgres helpers and transaction helper.
- `server/src/index.ts`: invoice CRUD routes.
- `server/db/schema.sql`: normalized invoice schema.
- `client/src/api.ts`: typed API wrapper.
- `client/src/App.tsx`: invoice form and list UI.

## Why Transactions Matter

An invoice and its line items must be saved together. This pattern protects against partial writes:

```ts
await withTransaction(async (client) => {
  const invoice = await client.query("INSERT INTO invoices ... RETURNING id", params);
  for (const item of input.items) {
    await client.query("INSERT INTO invoice_items ...", [invoiceId, item.description, item.quantity, item.unitPrice]);
  }
});
```

If any line item insert fails, the invoice insert rolls back. That is a core backend engineering habit.

## Do Not Trust Client Totals

Totals should be computed server-side:

```sql
COALESCE(SUM(ii.quantity * ii.unit_price), 0) AS total
```

Clients can display totals for convenience, but the server/database should own money math.

## Shared Type Contract

```ts
export interface NewInvoice {
  customerId: string;
  dueDate: string;
  items: NewInvoiceItem[];
}
```

This describes the exact shape the client sends and server expects. In bigger systems, shared contracts are how teams avoid accidental breaking changes.

## React Form Pattern

Line items are a dynamic array. Treat them immutably:

```tsx
setItems((current) => current.map((item, index) =>
  index === targetIndex ? { ...item, quantity: nextQuantity } : item
));
```

Avoid mutating nested state directly. React depends on new object/array references to detect changes.

## Extension Practice

- Add invoice status transitions.
- Add payments as child records.
- Add PDF export.
- Add validation that quantities are positive.
- Add transaction tests for partial failure.

Financial software is about invariants. Prefer boring, explicit code over clever shortcuts.
