# Stock Catalog - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4109**) with a
> `createProductRepository()` doing **server-side** filter -> sort -> slice and
> returning `{ items, total, totalPages, page, pageSize, sort, dir }`. Product
> fields: `id, name, category, price, stock`. `SORTABLE` whitelists sort columns.
> React client (`client/src/App.jsx`) sends the whole `query` object via
> `client/src/api.js`; sort headers and a pager already exist.

---

## Story 1: Low-stock threshold filter and badge
**As a** manager, **I want** to find low-stock products, **so that** I can reorder.

### Acceptance criteria
- [ ] Products gain a `reorderPoint`; a row with `stock <= reorderPoint` shows a "Low" badge (0 still shows "Out").
- [ ] A "Low stock only" filter narrows the list server-side.

### Implementation plan
1. **`server/server.js`** - add `reorderPoint` to `validateProduct`/`create`/`update` (default 0) and to `seedProducts`. In `query(...)`, accept a `lowOnly` flag and filter `product.stock <= product.reorderPoint` when set.
2. **`server/server.js`** - `GET /api/products` reads `lowOnly` from `req.query`.
3. **`client/src/App.jsx`** - add a "Low stock only" checkbox to `query` (reset to page 1 on change, like other filters); render a "Low" badge alongside the existing "Out" styling.

### How to test
Set a product's `reorderPoint` above its stock, enable "Low stock only", confirm only low/out products show with badges.

---

## Story 2: Bulk price adjustment
**As a** manager, **I want** to bump prices in a category, **so that** I can apply a markup quickly.

### Acceptance criteria
- [ ] `POST /api/products/bulk-price` accepts `{ category, percent }` and multiplies matching products' prices.
- [ ] The response reports how many rows changed; the client refreshes.
- [ ] A percent outside a sane range (e.g. '90..900) is rejected (400).

### Implementation plan
1. **`server/server.js`** - add the route: validate `percent`; in the repository add `bulkAdjustPrice(category, percent)` that maps products in that category to `price = round(price * (1 + percent/100), 2)`; return the count.
2. **`client/src/api.js`** - add `bulkPrice(body)`.
3. **`client/src/App.jsx`** - add a small form (category select + percent input) that calls it and then `refresh()`.

### How to test
Apply +10% to "Audio", confirm only Audio prices rise by 10% and the count is reported; try `percent: 5000` -> 400.

---

## Story 3: Export the current filter to CSV
**As a** manager, **I want** to export results, **so that** I can share them.

### Acceptance criteria
- [ ] `GET /api/products/export` accepts the same `search/category/sort/dir` params but ignores pagination (exports all matches).
- [ ] The response is CSV with a header row.

### Implementation plan
1. **`server/server.js`** - add the route; reuse the repository's filter+sort but skip the slice (or call `query` with a huge `pageSize`). Build CSV with a `csvCell` escaper and respond with `text/csv` + a `Content-Disposition` attachment header.
2. **`client/src/App.jsx`** - add an "Export CSV" button that opens the export URL built from the current `query` (minus page/pageSize) in a new tab.

### How to test
Filter by category + search, export, open the CSV, confirm every matching row is present (not just the visible page) and respects the sort.

---

## Story 4: Manage categories
**As a** manager, **I want** a category list endpoint, **so that** filters and forms stay consistent.

### Acceptance criteria
- [ ] `GET /api/categories` returns the distinct categories (the client already calls this - ensure it stays correct after edits).
- [ ] Creating a product with a new category makes it appear in the category dropdowns.

### Implementation plan
1. **`server/server.js`** - confirm/keep `repository.categories()` returning `[...new Set(products.map(p=>p.category))].sort()`. (This route already exists in the scaffold.)
2. **`client/src/App.jsx`** - the category dropdown is refreshed by the `useEffect([data.total])`; verify a newly created category appears after a create. If not, also refresh categories after a successful create.

### How to test
Create a product with category "Cameras", confirm "Cameras" appears in the filter and form dropdowns without a manual reload.

---

## Story 5: Inline edit within the table row
**As a** manager, **I want** to edit price/stock in the row, **so that** small fixes are fast.

### Acceptance criteria
- [ ] Clicking "Edit" turns a row's price and stock cells into inputs with Save/Cancel.
- [ ] Save calls `PUT /api/products/:id` with the full product and refreshes; Cancel reverts.
- [ ] Validation errors (negative price, non-integer stock) surface inline.

### Implementation plan
1. **`client/src/App.jsx`** - add `inlineId` state; when set, render the matching row's price/stock as `<input>`s seeded from the product, with Save/Cancel buttons.
2. **`client/src/App.jsx`** - Save builds the full product object (name/category unchanged + edited price/stock) and calls the existing `updateProduct(id, product)`, then clears `inlineId` and `refresh()`. The server's `validateProduct` already rejects bad values; show the error via `setMessage`.
3. No server change required - `PUT /api/products/:id` already exists.

### How to test
Inline-edit a price to 0 (saves) and to '5 (server 400, shown inline); edit stock to a decimal and confirm rejection; Cancel restores the original display.

