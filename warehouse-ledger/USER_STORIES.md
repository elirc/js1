# Warehouse Ledger - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4113**. Tables `products`,
> `warehouses`, `movements` (`delta`: + received / ' issued). Balances are
> derived (`COALESCE(SUM(delta),0)` over a `CROSS JOIN` of products-warehouses).
> Transfers are two movements in one `withTransaction` with a no-negative-stock
> check (`balanceOf`). `shared/types.ts` shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Product and warehouse management
**As an** admin, **I want** to manage products and warehouses, **so that** the catalog is editable.

### Acceptance criteria
- [ ] `POST/PUT/DELETE /api/products` and `POST/DELETE /api/warehouses` exist.
- [ ] `sku` stays unique (409 on duplicate); deleting cascades movements.
- [ ] The client has create forms for both.

### Implementation plan
1. **`server/src/index.ts`** - add product routes (validate `sku`, `name`, `reorderPoint`); catch unique-violation `23505` -> 409. Add warehouse create/delete (unique `name`). The `ON DELETE CASCADE` on `movements` already handles cleanup.
2. **`shared/types.ts`** - add `NewProduct`/`NewWarehouse` if helpful.
3. **`client/src/App.tsx`** - add small admin forms; refresh `products`/`warehouses`/`stock` after changes.

### How to test
Create a product (duplicate SKU -> 409), create a warehouse, record movements, delete the product and confirm its movements vanish from the ledger.

---

## Story 2: Stock valuation report
**As a** finance user, **I want** inventory value, **so that** I can report on assets.

### Acceptance criteria
- [ ] Products gain a `unit_cost numeric(12,2)`.
- [ ] `GET /api/reports/valuation` returns per-product `{ onHand, unitCost, value }` and a grand total.

### Implementation plan
1. **`server/db/schema.sql`** - add `unit_cost numeric(12,2) NOT NULL DEFAULT 0`. Re-run setup.
2. **`server/src/index.ts`** - add the route: aggregate `SUM(delta)` per product across all warehouses, join `products`, compute `value = onHand * unit_cost`; also return `SUM(value)` as the total.
3. **`shared/types.ts`** - add a `Valuation` interface; **`client/src/App.tsx`** - render a valuation panel with the grand total.

### How to test
Set unit costs and balances, hit the report, confirm each `value = onHand * unitCost` and the total sums them.

---

## Story 3: Concurrency-safe transfers (advisory lock)
**As an** engineer, **I want** transfers to be race-safe, **so that** two concurrent transfers can't oversell stock.

### Acceptance criteria
- [ ] The transfer transaction takes a lock keyed on `(product_id, from_warehouse_id)` before reading the balance.
- [ ] Two simultaneous transfers serialize so the second sees the first's effect.

### Implementation plan
1. **`server/src/index.ts`** - inside the transfer `withTransaction`, before `balanceOf`, run `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))` with the product and source-warehouse ids. The lock auto-releases at COMMIT/ROLLBACK.
2. Document the alternative (`SERIALIZABLE` isolation) in a comment.
3. No schema change.

### How to test
Hard to test by hand; reason through it, or fire two `POST /api/transfers` for the same product/source nearly simultaneously (e.g. `Promise.all`) when stock only covers one - confirm exactly one succeeds and the other 400s.

---

## Story 4: Movement reasons as an enum + filter
**As a** user, **I want** standard reasons, **so that** I can filter the ledger.

### Acceptance criteria
- [ ] Movements use a constrained `reason_code` (`receive, issue, adjust, transfer, return`) alongside the free-text note.
- [ ] The ledger endpoint filters by `reasonCode`.

### Implementation plan
1. **`server/db/schema.sql`** - add `reason_code text NOT NULL DEFAULT 'adjust' CHECK (reason_code IN ('receive','issue','adjust','transfer','return'))`. Re-run setup.
2. **`server/src/index.ts`** - accept `reasonCode` in `parseMovement` and the transfer (use `'transfer'`); include it in the ledger `SELECT` and add an optional `reasonCode` filter on `GET /api/products/:id/ledger`.
3. **`shared/types.ts`** + **`client/src/App.tsx`** - add the code to the movement form and a ledger filter dropdown.

### How to test
Record movements with different reason codes, filter the ledger by `transfer`, confirm only transfer rows show.

---

## Story 5: Export stock levels to CSV
**As a** manager, **I want** a stock export, **so that** I can share counts.

### Acceptance criteria
- [ ] `GET /api/stock/export` returns CSV: product, sku, warehouse, balance, reorderPoint, low.
- [ ] The client offers a "Download CSV" button.

### Implementation plan
1. **`server/src/index.ts`** - add the route reusing the `/api/stock` query (no filters or honoring the same ones), build CSV with an escaper, and respond with `text/csv` + a `Content-Disposition` attachment header.
2. **`client/src/App.tsx`** - add a button that opens the export URL (or fetches and downloads a Blob).

### How to test
Click "Download CSV", open it, confirm one row per product-warehouse with the live balance and a `low` boolean matching the on-screen badges.

