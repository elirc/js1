# Stock Catalog

A React + Node CRUD project that does **pagination, sorting, and filtering on
the server**. The client holds one page at a time, not the whole dataset.

## Learning goals

- Read `page`, `pageSize`, `sort`, `dir`, `search`, and `category` from the
  query string and validate/clamp them
- Apply operations in the right order: filter → sort → slice one page
- Return metadata the UI needs: `{ items, total, totalPages, page, pageSize }`
- Whitelist sortable columns so the client can't sort by arbitrary fields
- Build page controls and clickable sort headers in React
- Reset to page 1 whenever a filter or sort changes (a classic paging bug)

## The list endpoint

```
GET /api/products?search=&category=all&sort=name&dir=asc&page=1&pageSize=5
-> { items: [...], total, totalPages, page, pageSize, sort, dir }
```

The server seeds ~47 products so paging is actually visible.

## Suggested build order

1. Hit the endpoint in the browser and change query params by hand.
2. Trace `query()` in the repository: filter, sort, then `slice`.
3. Notice how the client sends the whole `query` object as the effect
   dependency, so any change refetches the correct page.

## Stretch ideas

- Add multi-column sort
- Add a total-inventory-value summary across all pages
- Move to SQL with `LIMIT`/`OFFSET` and `ORDER BY`

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): filter-sort-slice order and numeric boundaries, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
