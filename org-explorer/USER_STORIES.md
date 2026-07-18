# Org Explorer - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4116**. A self-referential
> `nodes` table (`parent_id`). `server/src/index.ts` reads the tree with
> `WITH RECURSIVE` (down for tree/subtree, up for ancestors), prevents cycles on
> move, and cascades deletes. `buildTree()` nests the flat rows. `shared/types.ts`
> shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Rolled-up headcount per manager
**As a** leader, **I want** total reports under each node, **so that** I can size teams.

### Acceptance criteria
- [ ] The node detail shows "Total reports" = number of descendants (already available as `descendantCount`) **and** the tree shows a per-node rollup badge.
- [ ] The rollup is computed in SQL with a recursive CTE, not in the client.

### Implementation plan
1. **`server/src/index.ts`** - add `GET /api/tree-counts` (or extend `GET /api/tree`) returning each node id with its descendant count: a `WITH RECURSIVE` that, for the whole table, counts descendants - simplest is to compute counts in `buildTree` by post-order summing children (document this is the in-app equivalent), or run a CTE per root. Prefer extending `buildTree` to also set `count` on each `TreeNode`.
2. **`shared/types.ts`** - add `reportCount: number` to `TreeNode`.
3. **`client/src/App.tsx`** - render the count badge on each `NodeBranch`.

### How to test
A manager with 2 directs who each have 1 report shows a rollup of 4; a leaf shows 0.

---

## Story 2: Search nodes and reveal their path
**As a** user, **I want** to search people, **so that** I can jump to them in a big chart.

### Acceptance criteria
- [ ] A search box matches `name`/`title`; matches are highlighted in the tree.
- [ ] Selecting a result expands/scrolls to it and shows its ancestor breadcrumb (already returned by `GET /api/nodes/:id`).

### Implementation plan
1. **`client/src/App.tsx`** - add a `query` state; in `NodeBranch`, add a `match` class when `node.name`/`title` includes the query (case-insensitive). Pure client filtering over the already-loaded tree.
2. **`client/src/App.tsx`** - clicking a match sets `selectedId` (the detail panel already loads ancestors via `getNode`).
3. Optional server route `GET /api/search?q=` if the tree grows large.

### How to test
Type part of a name, confirm matching nodes highlight; click one and confirm the breadcrumb shows its path to the root.

---

## Story 3: Drag-and-drop re-parenting
**As a** user, **I want** to drag a node onto a new manager, **so that** reorganizing is fast.

### Acceptance criteria
- [ ] Dragging a node onto another calls `PATCH /api/nodes/:id/move` with the target as the new parent.
- [ ] Dropping onto the node's own descendant is rejected (server returns 400 - the cycle check already exists) and shows a message.

### Implementation plan
1. **`client/src/App.tsx`** - make each `NodeBranch` button `draggable`; on `dragstart` store the dragged id; on a node's `drop`, call `moveNode(draggedId, targetId)` then `refresh()`.
2. **`client/src/App.tsx`** - surface the 400 message from the existing `moveNode` error path.
3. No server change - `PATCH .../move` and its recursive cycle check already exist.

### How to test
Drag an IC under a different manager (moves); drag a manager onto one of its own reports (rejected with the cycle message).

---

## Story 4: Depth and span-of-control validation
**As an** admin, **I want** structural rules, **so that** the chart stays healthy.

### Acceptance criteria
- [ ] Moves/creates that would exceed a max depth (e.g. 6) are rejected (400).
- [ ] A node may not exceed a max number of direct reports (e.g. 10) - also 400.

### Implementation plan
1. **`server/src/index.ts`** - in the move/create handlers, compute the target's depth with the existing ancestor CTE; reject when `depth + subtreeHeight > MAX_DEPTH`. (Subtree height needs a small recursive `MAX(depth)` query on the moved node's subtree.)
2. **`server/src/index.ts`** - before adding a child, `SELECT COUNT(*) FROM nodes WHERE parent_id = $1`; reject at the limit.
3. **`client/src/App.tsx`** - show the rejection messages (already wired through the error path).

### How to test
Build a chain to the depth limit, attempt one more level (rejected); give a manager the max reports, add one more (rejected).

---

## Story 5: Export a subtree as JSON
**As a** user, **I want** to export part of the org, **so that** I can share or back it up.

### Acceptance criteria
- [ ] `GET /api/nodes/:id/export` returns the node and its full subtree as nested JSON.
- [ ] The client offers "Export subtree" on the selected node.

### Implementation plan
1. **`server/src/index.ts`** - reuse the subtree recursive query to fetch all descendants of `:id`, then run them through `buildTree` (rooted at `:id`) and return the single nested node.
2. **`client/src/App.tsx`** - add an "Export subtree" button on the detail panel that fetches the JSON and triggers a Blob download (`<id>-subtree.json`).

### How to test
Export a VP's subtree, open the file, confirm the VP node with nested children matches what's on screen.

