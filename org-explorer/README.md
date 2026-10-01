# Org Explorer (TypeScript · React · Node · Postgres)

An org-chart manager whose lesson is **hierarchical data with recursive CTEs**.
Nodes are stored as a plain adjacency list (`parent_id`), and every interesting
query walks the tree with `WITH RECURSIVE`.

## What it teaches

- The adjacency-list model: one self-referencing foreign key
- `WITH RECURSIVE` to walk **down** (full tree, subtree) carrying a `depth`
- `WITH RECURSIVE` to walk **up** (ancestors / breadcrumb path)
- Computing `descendantCount` from a recursive subtree
- **Cycle prevention**: before re-parenting, check the target isn't inside the
  node's own subtree, or you'd create an infinite loop
- `ON DELETE CASCADE` to drop an entire subtree in one statement
- Turning a flat recursive result into nested JSON in TypeScript

## Key queries (see `server/src/index.ts`)

```sql
-- Descend from the roots
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name, title, 0 AS depth FROM nodes WHERE parent_id IS NULL
  UNION ALL
  SELECT n.*, t.depth + 1 FROM nodes n JOIN tree t ON n.parent_id = t.id
) SELECT * FROM tree;

-- Ascend to find ancestors
WITH RECURSIVE up AS (
  SELECT * FROM nodes WHERE id = $1
  UNION ALL
  SELECT n.* FROM nodes n JOIN up u ON n.id = u.parent_id
) SELECT * FROM up;
```

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb org_explorer
npm install
npm run db:setup
npm run dev          # API on :4116, client on :5116
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## Stretch ideas

- Add a materialized `path` (ltree) for O(1) subtree queries and compare.
- Add "headcount rolled up" per manager using the recursive subtree.
- Add depth limits or org-level validation rules.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): recursive queries, structural invariants and concurrent tree moves, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
