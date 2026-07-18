# Budget Tracker Codebase Guide

This app is a small financial CRUD system. The useful lesson is not just adding records; it is computing trustworthy derived totals from stored records.

## Code Map

- `index.html`: transaction form, summary totals, filter controls, list container.
- `styles.css`: transaction cards and positive/negative amount styling.
- `app.js`: state, validation, persistence, filtering, rendering, derived totals.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  description: "Course subscription",
  category: "Education",
  type: "expense",
  amount: 39,
  date: "2026-06-08"
}
```

Money values are stored as numbers here for simplicity. In production, money is commonly stored as integer cents to avoid floating-point surprises.

## Validation Before Mutation

```js
if (!transaction.description || !transaction.category || !transaction.date || transaction.amount <= 0) {
  setMessage("Add a valid description, category, amount, and date.");
  return;
}
```

The important sequence is validate first, mutate second, persist third, render last. Bugs often happen when code mutates state before checking whether input is valid.

## Derived Totals

```js
const totals = transactions.reduce((summary, transaction) => {
  summary[transaction.type] += transaction.amount;
  return summary;
}, { income: 0, expense: 0 });
```

This is derived state: income, expenses, and balance are not stored separately. They are computed from transactions each render. This avoids inconsistent data like `balance` not matching the transaction list.

## Formatting Boundary

```js
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
```

Keep formatting at the display boundary. Store raw values; format only when rendering. This habit matters in APIs, databases, and analytics pipelines.

## Filtering

```js
const matchesType = typeFilter === "all" || transaction.type === typeFilter;
const searchable = `${transaction.description} ${transaction.category} ${transaction.type}`.toLowerCase();
return matchesType && searchable.includes(searchTerm);
```

This mirrors backend query construction. First define filters, then apply them consistently.

## Extension Practice

- Store `amountCents` instead of `amount`.
- Add monthly grouping.
- Add category totals.
- Add a "duplicate transaction" action.
- Add server-style validation comments before every business rule.

When extending, ask: what is source data and what should be derived?
