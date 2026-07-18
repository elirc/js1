# Stock Catalog Codebase Guide

Stock Catalog teaches server-side pagination, sorting, and filtering. This is a core pattern in enterprise dashboards and admin tables.

## Code Map

- `server/server.js`: product repository, query params, validation.
- `client/src/api.js`: product and category API calls.
- `client/src/App.jsx`: filters, paging state, product form.

## Query Parameter Parsing

```js
const sort = SORTABLE.includes(req.query.sort) ? req.query.sort : "name";
const dir = req.query.dir === "desc" ? "desc" : "asc";
const page = Math.max(1, Number(req.query.page) || 1);
const pageSize = clamp(Number(req.query.pageSize) || 5, 1, 50);
```

Never trust query params. Whitelist sort fields and clamp page sizes so one request cannot ask for unlimited data.

## Correct Query Order

The repository applies operations in this order:

```js
filter -> sort -> paginate
```

That order matters. If you paginate before filtering, users may get wrong totals and missing results.

## Page Response Shape

```js
{
  items,
  total,
  totalPages,
  page,
  pageSize
}
```

The UI needs both records and metadata. This response shape is common in REST APIs.

## Product Validation

```js
if (!name || !category || Number(price) < 0 || Number(stock) < 0) {
  return res.status(400).json({ error: "Product fields are invalid." });
}
```

Keep validation near the route or in a named middleware. Either way, make it obvious before mutation happens.

## Extension Practice

- Add SKU uniqueness.
- Add low-stock filtering.
- Add server-side category counts.
- Add optimistic UI updates.
- Replace in-memory repository with database queries.

Admin tables are deceptively important. Learn pagination and sorting early.
