import { pathToFileURL } from "node:url";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool, query } from "./db.js";
import type { NewNode, NodeDetail, OrgNode, TreeNode } from "../../shared/types.js";

export const app = express();
const port = Number(process.env.PORT ?? 4116);

app.use(cors());
app.use(express.json());
app.param("id",(_req,res,next,value) => { if (!validId(value)) return res.status(400).json({ error: "Use a valid node id." }); next(); });

interface FlatRow {
  id: string;
  parent_id: string | null;
  name: string;
  title: string;
  depth: number;
}

// GET full tree. The recursive CTE walks down from the roots, tagging depth;
// we then assemble the flat rows into nested children in JS.
app.get("/api/tree", asyncRoute(async (_req, res) => {
  const rows = await query<FlatRow>(
    `WITH RECURSIVE tree AS (
       SELECT id, parent_id, name, title, 0 AS depth
         FROM nodes WHERE parent_id IS NULL
       UNION ALL
       SELECT n.id, n.parent_id, n.name, n.title, t.depth + 1
         FROM nodes n JOIN tree t ON n.parent_id = t.id
     )
     SELECT id, parent_id, name, title, depth FROM tree`
  );
  res.json(buildTree(rows));
}));

// GET one node's derived facts: its depth, how many descendants it has, and the
// chain of ancestors from the root down to its parent.
app.get("/api/nodes/:id", asyncRoute(async (req, res) => {
  const { id } = req.params;

  const subtree = await query<{ id: string }>(
    `WITH RECURSIVE sub AS (
       SELECT id FROM nodes WHERE id = $1
       UNION ALL
       SELECT n.id FROM nodes n JOIN sub s ON n.parent_id = s.id
     )
     SELECT id FROM sub`,
    [id]
  );
  if (subtree.length === 0) return res.status(404).json({ error: "Node not found." });

  const ancestorRows = await query<FlatRow>(
    `WITH RECURSIVE up AS (
       SELECT id, parent_id, name, title, 0 AS depth FROM nodes WHERE id = $1
       UNION ALL
       SELECT n.id, n.parent_id, n.name, n.title, u.depth + 1
         FROM nodes n JOIN up u ON n.id = u.parent_id
     )
     SELECT id, parent_id, name, title, depth FROM up WHERE id <> $1 ORDER BY depth DESC`,
    [id]
  );

  const [self] = await query<FlatRow>(
    "SELECT id, parent_id, name, title, 0 AS depth FROM nodes WHERE id = $1",
    [id]
  );

  const detail: NodeDetail = {
    node: toNode(self!),
    depth: ancestorRows.length,
    descendantCount: subtree.length - 1,
    ancestors: ancestorRows.map(toNode)
  };
  res.json(detail);
}));

app.post("/api/nodes", asyncRoute(async (req, res, next) => {
  try {
    const input = parseNode(req.body);
    if (input.parentId) {
      const parent = await query("SELECT 1 FROM nodes WHERE id = $1", [input.parentId]);
      if (parent.length === 0) throw new ValidationError("Parent does not exist.");
    }
    const [node] = await query<FlatRow>(
      "INSERT INTO nodes (parent_id, name, title) VALUES ($1, $2, $3) RETURNING id, parent_id, name, title, 0 AS depth",
      [input.parentId, input.name, input.title]
    );
    res.status(201).json(toNode(node!));
  } catch (error) {
    next(error);
  }
}));

app.put("/api/nodes/:id", asyncRoute(async (req, res, next) => {
  try {
    if (typeof req.body?.name !== "string" || req.body.name.length > 200 || req.body.title !== undefined && (typeof req.body.title !== "string" || req.body.title.length > 200))
      throw new ValidationError("Use bounded text for name and title.");
    const name = req.body.name.trim();
    const title = String(req.body.title ?? "").trim();
    if (name.length < 1) throw new ValidationError("Name is required.");
    const { rowCount } = await pool.query(
      "UPDATE nodes SET name = $2, title = $3 WHERE id = $1",
      [req.params.id, name, title]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Node not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}));

// Move a node under a new parent. The key safety check: the new parent must not
// be the node itself or any of its descendants, or we'd create a cycle.
app.patch("/api/nodes/:id/move", asyncRoute(async (req, res, next) => {
  try {
    const id = req.params.id;
    const newParentId = req.body?.newParentId;
    if (newParentId !== null && !validId(newParentId)) throw new ValidationError("Choose a valid parent id or null for a root.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Bound the wait: a caller should get a fast 503-style answer, not hang behind a long writer.
      await client.query("SET LOCAL lock_timeout = '3s'");
      // All structural writers conflict with this lock; readers can continue.
      await client.query("LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE");
      const node = await client.query("SELECT id FROM nodes WHERE id=$1",[id]);
      if (!node.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Node not found." }); }
      if (newParentId !== null) {
        const parent = await client.query("SELECT id FROM nodes WHERE id=$1",[newParentId]);
        if (!parent.rows.length) throw new ValidationError("Parent does not exist.");
        const descendants = await client.query(`WITH RECURSIVE sub AS (
          SELECT id FROM nodes WHERE id=$1 UNION SELECT n.id FROM nodes n JOIN sub s ON n.parent_id=s.id
        ) SELECT id FROM sub WHERE id=$2`,[id,newParentId]);
        if (descendants.rows.length) throw new ValidationError("Cannot move a node beneath itself or a descendant.");
      }
      await client.query("UPDATE nodes SET parent_id=$2 WHERE id=$1",[id,newParentId]);
      await client.query("COMMIT"); res.json({ ok: true });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    next(error);
  }
}));

app.delete("/api/nodes/:id", asyncRoute(async (req, res) => {
  // ON DELETE CASCADE removes the whole subtree.
  const { rowCount } = await pool.query("DELETE FROM nodes WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Node not found." });
  res.status(204).send();
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if ((error as { code?: string }).code === "55P03") {
    res.set("Retry-After", "3");
    return res.status(503).json({ error: "The tree is being restructured; retry in a moment." });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Org Explorer API on http://localhost:${port}`);
});

function toNode(row: FlatRow): OrgNode {
  return { id: row.id, parentId: row.parent_id, name: row.name, title: row.title };
}

function buildTree(rows: FlatRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const row of rows) {
    byId.set(row.id, { ...toNode(row), depth: row.depth, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortRec(node.children));
  };
  sortRec(roots);
  return roots;
}

class ValidationError extends Error {}

function parseNode(body: unknown): NewNode {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Send a node object.");
  const data = body as Partial<NewNode>;
  if (typeof data.name !== "string" || data.name.length > 200 || data.title !== undefined && (typeof data.title !== "string" || data.title.length > 200) || data.parentId != null && !validId(data.parentId))
    throw new ValidationError("Use bounded names/titles and a valid parent id.");
  const name = (data.name ?? "").trim();
  if (name.length < 1) throw new ValidationError("Name is required.");
  return {
    parentId: data.parentId ? String(data.parentId) : null,
    name,
    title: (data.title ?? "").trim()
  };
}

function asyncRoute(handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>): express.RequestHandler {
  return (req,res,next) => { Promise.resolve(handler(req,res,next)).catch(next); };
}

function validId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value); }
