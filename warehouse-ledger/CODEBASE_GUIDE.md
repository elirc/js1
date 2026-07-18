# Warehouse Ledger Codebase Guide

Warehouse Ledger teaches the ledger pattern: stock is not stored as one mutable number; it is derived from immutable movement rows.

## Code Map

- `shared/types.ts`: product, warehouse, movement, transfer contracts.
- `server/src/db.ts`: Postgres helper and transaction helper.
- `server/src/index.ts`: stock, ledger, movement, transfer routes.
- `server/db/schema.sql`: products, warehouses, movements.
- `client/src/api.ts`: typed API calls.
- `client/src/App.tsx`: stock grid, adjustment form, transfer form.

## Ledger Thinking

```sql
SELECT product_id, warehouse_id, COALESCE(SUM(delta), 0) AS quantity
FROM stock_movements
GROUP BY product_id, warehouse_id;
```

The current quantity is the sum of movements. This preserves history and makes audits possible.

## Transfer as Two Rows

```ts
await withTransaction(async (client) => {
  await client.query("INSERT INTO stock_movements ...", [fromWarehouseId, -quantity]);
  await client.query("INSERT INTO stock_movements ...", [toWarehouseId, quantity]);
});
```

A transfer must debit one warehouse and credit another atomically. If either row fails, both should roll back.

## Cross Join for Full Grid

```sql
FROM products p
CROSS JOIN warehouses w
LEFT JOIN stock_totals st ON ...
```

This ensures every product/warehouse combination appears, even when quantity is zero. Reporting often needs complete grids, not just rows with activity.

## Frontend State

```tsx
const [stock, setStock] = useState<StockLevel[]>([]);
const [ledger, setLedger] = useState<{ productId: string; rows: Movement[] } | null>(null);
```

The app separates the summary view (`stock`) from drill-down detail (`ledger`). This is a common dashboard pattern.

## Extension Practice

- Prevent transfers that make stock negative.
- Add movement reasons as required categories.
- Add date-range filters for the ledger.
- Add product creation.
- Add tests for transaction rollback.

Ledger systems optimize for auditability. Never delete history casually.
