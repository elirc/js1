# Pantry Inventory Codebase Guide

This project models inventory, which is a common business domain. The key lesson is working with quantities, thresholds, tables, and derived status.

## Code Map

- `index.html`: item form, stats, filters, table.
- `styles.css`: table layout, stock status styles, responsive behavior.
- `app.js`: CRUD, low-stock calculations, filtering, persistence.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  name: "Tomato cans",
  category: "Canned",
  quantity: 1,
  minimum: 3,
  expires: "2027-02-15"
}
```

`quantity` and `minimum` are business fields. A production inventory app would protect these with server validation and sometimes audit logs.

## Numeric Normalization

```js
quantity: Number(quantityInput.value),
minimum: Number(minimumInput.value)
```

HTML inputs return strings. Convert at the boundary so the rest of the code can reason about numbers. This is the same reason APIs parse and validate JSON request bodies.

## Derived Stock Status

```js
const statusText = item.quantity <= item.minimum ? "Low" : "Fresh";
status.classList.toggle("low", statusText === "Low");
```

Notice that `status` is not stored. It is derived from `quantity` and `minimum`. In larger codebases, derived state prevents data drift.

## Table Rendering

```js
const row = document.createElement("tr");
row.innerHTML = `
  <td>
    <strong class="name"></strong><br>
    <span class="status"></span>
  </td>
`;
```

The code creates a shell with `innerHTML`, then fills text with `textContent`. That avoids putting raw user input directly into HTML.

## Filter Logic

```js
const isLow = item.quantity <= item.minimum;
const matchesFilter = activeFilter === "All" || (activeFilter === "Low" && isLow) || (activeFilter === "Fresh" && !isLow);
```

This is a small business rule. Name intermediate values like `isLow` so future readers do not have to mentally parse everything.

## Extension Practice

- Add an `aisle` field.
- Sort by expiration date.
- Add "consume one" and "restock" actions.
- Add an expired status.
- Add a history array for quantity changes.

Inventory systems often become ledger systems. If you add history, do not overwrite past movements.
