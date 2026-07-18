# Invoice Studio - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4110**. `shared/types.ts` is
> imported by both ends. `server/src/db.ts` exposes `query`, `pool`, and
> `withTransaction`. `server/src/index.ts` holds routes; invoices + items are
> created/updated atomically and totals are computed in SQL. Schema in
> `server/db/schema.sql` (`clients -> invoices -> invoice_items`, status
> draft/sent/paid). React client in `client/src/App.tsx` / `api.ts`.

---

## Story 1: Edit an existing invoice in the UI
**As a** user, **I want** to edit invoices, **so that** I can fix mistakes (the API already supports it).

### Acceptance criteria
- [ ] Clicking "Edit" on an invoice loads it (header + line items) into the form.
- [ ] Saving calls `PUT /api/invoices/:id` and the list updates.
- [ ] A "Cancel edit" button returns the form to create mode.

### Implementation plan
1. **`client/src/api.ts`** - `getInvoice` and `updateInvoice` already exist; no change.
2. **`client/src/App.tsx`** - add `editingId` state; add an "Edit" button per invoice card that calls `getInvoice(id)`, then sets `clientId/status/issuedDate/taxRate/lines` from the response.
3. **`client/src/App.tsx`** - in `handleSubmit`, branch on `editingId`: call `updateInvoice(editingId, payload)` vs `createInvoice`. Add a "Cancel edit" button that clears `editingId` and resets the form.

### How to test
Edit an invoice's line items and tax rate, save, confirm totals recompute and the card updates; Cancel returns to a blank create form.

---

## Story 2: Record `paid_at` when status becomes paid
**As a** user, **I want** to know when an invoice was paid, **so that** I can report on cash flow.

### Acceptance criteria
- [ ] A `paid_at timestamptz` column is set when status moves to `paid`, cleared otherwise.
- [ ] The API returns `paidAt`; the card shows the paid date.
- [ ] A `?paid=true` filter lists only paid invoices.

### Implementation plan
1. **`server/db/schema.sql`** - add `paid_at timestamptz` to `invoices`. Re-run `npm run db:setup`.
2. **`server/src/index.ts`** - in the status `PATCH`, set `paid_at = CASE WHEN $2='paid' THEN now() ELSE NULL END`. Add `paidAt` to the summary `SELECT` and to `toSummary`.
3. **`shared/types.ts`** - add `paidAt: string | null` to `InvoiceSummary`.
4. **`server/src/index.ts`** - in `GET /api/invoices`, support `paid=true` -> `WHERE status = 'paid'`.
5. **`client/src/App.tsx`** - show the paid date when present; add the filter to the dropdown.

### How to test
Cycle an invoice to `paid`, confirm `paidAt` populates and shows; move it back to `sent`, confirm it clears; filter paid-only.

---

## Story 3: Monthly revenue report
**As an** owner, **I want** revenue by month, **so that** I can see trends.

### Acceptance criteria
- [ ] `GET /api/reports/monthly` returns `{ month, invoiceCount, revenue }` per month for paid invoices.
- [ ] Months are formatted `YYYY-MM` and ordered ascending.

### Implementation plan
1. **`server/src/index.ts`** - add the route running a query that joins items, groups by `date_trunc('month', i.issued_date)`, filters `i.status='paid'`, and sums `it.quantity*it.unit_price * (1 + i.tax_rate/100)` for revenue. Convert numerics to numbers.
2. **`shared/types.ts`** - add a `MonthlyRevenue` interface.
3. **`client/src/App.tsx`** - add a small report panel (a bar per month) fed by a new `getMonthlyReport()` in `api.ts`.

### How to test
Mark invoices paid across two months, hit the report, confirm one row per month with correct counts and tax-inclusive revenue.

---

## Story 4: Printable invoice view
**As a** user, **I want** a clean printable invoice, **so that** I can send it to a client.

### Acceptance criteria
- [ ] Selecting an invoice opens a print-friendly layout (client info, line items, totals).
- [ ] A "Print" button triggers `window.print()`; a print stylesheet hides app chrome.

### Implementation plan
1. **`client/src/App.tsx`** - add a `selectedInvoice` state; on "View", call `getInvoice(id)` and render a `<section class="print-view">` with the client name, dated header, an items table, and the subtotal/tax/total block.
2. **`client/src/styles.css`** - add `@media print { body * { visibility:hidden } .print-view, .print-view * { visibility:visible } .print-view { position:absolute; inset:0 } }`.
3. **`client/src/App.tsx`** - a "Print" button calls `window.print()`.

### How to test
Open an invoice's print view, press Print (or Ctrl+P), confirm only the invoice shows in the print preview with correct totals.

---

## Story 5: Per-line discount
**As a** user, **I want** a discount on the invoice, **so that** I can offer deals.

### Acceptance criteria
- [ ] Invoices store a `discount` (percent 0-100) applied to the subtotal before tax.
- [ ] Totals become `taxable = subtotal*(1-discount/100)`, `tax = taxable*taxRate/100`, `total = taxable+tax`.
- [ ] Create/edit and the printable view reflect the discount.

### Implementation plan
1. **`server/db/schema.sql`** - add `discount numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 100)`. Re-run setup.
2. **`server/src/index.ts`** - include `discount` in insert/update, the summary `SELECT`, and recompute `tax`/`total` in `toSummary` using the formula above.
3. **`shared/types.ts`** - add `discount: number` to `InvoiceSummary` and `NewInvoice`; validate it in `parseInvoice`.
4. **`client/src/App.tsx`** - add a discount input and show the discounted subtotal in the live totals + print view.

### How to test
Add a 10% discount to a $1000 subtotal at 8.5% tax: taxable $900, tax $76.50, total $976.50 - confirm the UI and stored summary match.

