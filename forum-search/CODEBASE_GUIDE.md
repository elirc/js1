# Forum Search Codebase Guide

This project is a serious step toward corporate backend work: React + TypeScript + Express + Postgres, with full-text search, tags, pagination, and shared types.

## Code Map

- `shared/types.ts`: API/domain contracts shared by client and server.
- `server/src/db.ts`: Postgres pool, query helper, transaction helper.
- `server/src/index.ts`: Express routes and SQL queries.
- `server/db/schema.sql`: tables, indexes, generated search column.
- `client/src/api.ts`: typed client API functions.
- `client/src/App.tsx`: search UI, tag filters, thread creation, pagination.

## Shared Types

```ts
export interface ThreadPage {
  items: ThreadSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

Shared types reduce drift between server responses and frontend expectations. In larger codebases, this might become OpenAPI, GraphQL codegen, or shared packages.

## Typed Query Helper

```ts
export async function query<Row>(text: string, params: unknown[] = []): Promise<Row[]> {
  const result = await pool.query(text, params);
  return result.rows as Row[];
}
```

This makes route code readable while preserving row typing at call sites. The type is still a promise you keep with yourself: SQL must actually return that shape.

## Full-Text Search Query

```ts
WHERE ($1 = '' OR t.search @@ websearch_to_tsquery('english', $1))
ORDER BY ts_rank(t.search, websearch_to_tsquery('english', $1)) DESC
```

This is database-backed search. Instead of filtering strings in JavaScript, Postgres ranks and indexes searchable text.

## Transaction for Tags

```ts
const id = await withTransaction(async (client) => {
  const { rows } = await client.query("INSERT INTO threads ... RETURNING id", [...]);
  for (const name of input.tagNames) {
    await client.query("INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
  }
  return rows[0]!.id;
});
```

Thread creation and tag linking belong in one transaction. If linking fails, the thread insert rolls back too.

## Frontend Highlighting Safely

```tsx
const parts = text.split(/\[\[(.+?)\]\]/g);
return parts.map((part, index) =>
  index % 2 === 1 ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>
);
```

The client does not use `dangerouslySetInnerHTML`. It turns markers into React text nodes, which is safer.

## Extension Practice

- Add editing threads.
- Add comments as a child resource.
- Add author filters.
- Add query timing logs.
- Add database tests for search ranking.

Production lesson: let the database do search when the database has the right index and query features.
