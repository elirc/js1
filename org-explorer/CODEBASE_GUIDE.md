# Org Explorer Codebase Guide

Org Explorer teaches hierarchical data. Many corporate systems model trees: org charts, folders, categories, permissions, and account hierarchies.

## Code Map

- `shared/types.ts`: employee/org node contracts.
- `server/src/db.ts`: Postgres helper.
- `server/src/index.ts`: recursive SQL routes.
- `server/db/schema.sql`: self-referencing table.
- `client/src/api.ts`: typed API calls.
- `client/src/App.tsx`: tree rendering and forms.

## Adjacency List Model

```sql
parent_id uuid REFERENCES employees(id)
```

Each row points to its parent. This is simple to write and flexible, but tree queries require recursion.

## Recursive CTE

```sql
WITH RECURSIVE tree AS (
  SELECT id, name, manager_id, 0 AS depth FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, tree.depth + 1
  FROM employees e
  JOIN tree ON e.manager_id = tree.id
)
SELECT * FROM tree;
```

`WITH RECURSIVE` is how SQL walks a tree. Learn this; it appears in real reporting, permission, and hierarchy work.

## Derived Descendant Counts

The server can compute counts from the tree instead of asking the client to infer them. Put hierarchy logic close to the data.

## Frontend Tree Rendering

```tsx
{nodes.map((node) => (
  <article style={{ marginLeft: node.depth * 20 }} key={node.id}>
    {node.name}
  </article>
))}
```

Depth from the server becomes indentation in the UI. This is a clean server/client responsibility split.

## Extension Practice

- Prevent cycles when changing managers.
- Add breadcrumbs using an ancestor query.
- Add subtree delete with confirmation.
- Add drag-and-drop reparenting.
- Add database tests for recursive queries.

Hierarchy bugs can be subtle. Always consider cycles, orphan nodes, and deletion behavior.
