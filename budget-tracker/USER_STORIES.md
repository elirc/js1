# Budget Tracker - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. Data is the `transactions`
> array (fields: `id, description, category, type` (`income`/`expense`),
> `amount, date`), plus `editingId`, `searchTerm`, `typeFilter`.
> `renderTransactions()` recomputes income/expense/balance totals and rebuilds
> the list from `getVisibleTransactions()`. `formatCurrency`/`formatDate` exist.

---

## Story 1: Filter by month
**As a** user, **I want** to view a single month, **so that** I can review monthly spending.

### Acceptance criteria
- [ ] A month picker (`<input type="month">`) limits the list and the totals to that month.
- [ ] An "All time" option shows everything.
- [ ] Totals (income/expense/balance) reflect the selected month.

### Implementation plan
1. **`index.html`** - add `<input type="month" id="month-filter">` and a "clear" button in the toolbar.
2. **`app.js`** - add `let monthFilter = "";` (format `YYYY-MM`). Add a `change` listener setting it and re-rendering.
3. **`getVisibleTransactions()`** - add `&& (!monthFilter || transaction.date.startsWith(monthFilter))`.
4. **`renderTransactions()`** - change the totals reducer to run over the *month-filtered* set, not the full `transactions`. Extract a `function transactionsInScope()` that applies only the month filter (not search/type) and use it for totals so totals match the visible month.

### How to test
Add transactions across two months, pick one month, confirm both the list and the three totals reflect only that month.

---

## Story 2: Category breakdown summary
**As a** user, **I want** spend grouped by category, **so that** I see where money goes.

### Acceptance criteria
- [ ] A panel lists each expense category with its total and a proportional bar.
- [ ] Categories are sorted by total descending and respect the active month filter.

### Implementation plan
1. **`index.html`** - add `<section id="category-breakdown">`.
2. **`app.js`** - add `function renderBreakdown(scope){ const byCat = {}; scope.filter(t=>t.type==='expense').forEach(t=>byCat[t.category]=(byCat[t.category]||0)+t.amount); const max = Math.max(1, ...Object.values(byCat)); /* build sorted rows with width:${total/max*100}% bars */ }`.
3. **`renderTransactions()`** - call `renderBreakdown(transactionsInScope())` (from Story 1, or just the full list if Story 1 isn't built).
4. **`styles.css`** - add a `.cat-bar` style.

### How to test
Add expenses in several categories, confirm the panel totals match and bars scale to the largest category.

---

## Story 3: Per-category monthly budget with warnings
**As a** user, **I want** to set spending limits, **so that** I'm warned when I overspend.

### Acceptance criteria
- [ ] I can set a monthly limit per category (stored separately in localStorage).
- [ ] When a category's month total exceeds its limit, its breakdown row turns red and shows "Over by $X".
- [ ] Categories without a limit show no warning.

### Implementation plan
1. **`app.js`** - add a `let budgets = JSON.parse(localStorage.getItem("js1-budgets") || "{}")` map of `category -> limit`, and `function saveBudgets()`.
2. **`index.html`** - add a small form (category select + amount input) to set a limit; on submit set `budgets[category]=amount`, `saveBudgets()`, re-render.
3. **`renderBreakdown()`** - for each category, if `budgets[cat]` exists and `total > budgets[cat]`, add class `over` and append `Over by ${formatCurrency(total - budgets[cat])}`.
4. **`styles.css`** - add `.cat-row.over { color: var(--danger) }`.

### How to test
Set a $100 limit on "Food", add $130 of Food expenses in the month, confirm the row turns red with "Over by $30".

---

## Story 4: Export transactions to CSV
**As a** user, **I want** to export my data, **so that** I can analyze it in a spreadsheet.

### Acceptance criteria
- [ ] An "Export CSV" button downloads `transactions.csv` (header + rows) for the current scope (respecting the month filter if built).
- [ ] Amount and date are unformatted (raw number, `YYYY-MM-DD`) for spreadsheet use.

### Implementation plan
1. **`index.html`** - add `<button id="export-csv">`.
2. **`app.js`** - add a `csvCell(v)` escaper (quote values containing `,"\n`). Build header `["date","description","category","type","amount"]` then rows from the scoped list.
3. **`app.js`** - download via Blob (`text/csv`) + temporary `<a download="transactions.csv">`.

### How to test
Export, open in a spreadsheet, confirm columns line up and amounts are plain numbers.

---

## Story 5: Quick-add from recurring templates
**As a** user, **I want** to save recurring transactions, **so that** I can re-add them in one click.

### Acceptance criteria
- [ ] A "Save as template" action stores the current form values as a named template.
- [ ] Templates appear as buttons; clicking one fills the form with that template's values (today's date).
- [ ] Templates persist in localStorage and can be deleted.

### Implementation plan
1. **`app.js`** - add `let templates = JSON.parse(localStorage.getItem("js1-tx-templates") || "[]")` and `saveTemplates()`.
2. **`index.html`** - add a "Save as template" button next to the form and a `<div id="templates">` to hold template buttons.
3. **`app.js`** - "Save as template": build an object from the current inputs (description, category, type, amount) and push to `templates`; persist; `renderTemplates()`.
4. **`app.js`** - `renderTemplates()` builds a button per template (and a small - delete). Clicking a template sets the form inputs and `dateInput.value = new Date().toISOString().slice(0,10)`; it does **not** auto-submit (user reviews then clicks Add).

### How to test
Fill the form, save a "Rent" template, reset, click "Rent", confirm the form repopulates with today's date; delete the template and confirm it's gone after reload.

