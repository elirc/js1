import express from "express";
import cors from "cors";
import { query, withTransaction } from "./db.js";
import type { ActivityEntry, Item, NewItem, Page, Stats } from "../../shared/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4234);
const STATUSES = ["Draft", "Legal Review", "Active", "Renewal", "Expired"];
const CATEGORIES = ["SaaS", "Consulting", "Facilities", "Security"];
const SORT_COLUMNS: Record<string, string> = {
  title: "title",
  owner: "owner",
  category: "category",
  status: "status",
  amount: "amount",
  priority: "priority",
  dueDate: "due_date",
  createdAt: "created_at"
};

app.use(cors());
app.use(express.json());

app.get("/api/contracts", async (req, res) => {
  const filters = parseQuery(req.query as Record<string, unknown>);
  const sortColumn = SORT_COLUMNS[filters.sort] ?? "created_at";
  const dir = filters.dir === "asc" ? "ASC" : "DESC";
  const rows = await query<ItemRow & { total: string }>(
    `SELECT *, COUNT(*) OVER() AS total FROM items
      WHERE ($1 = '' OR to_tsvector('english', title || ' ' || owner || ' ' || category || ' ' || notes) @@ websearch_to_tsquery('english', $1))
        AND ($2 = 'all' OR status = $2)
        AND ($3 = 'all' OR category = $3)
      ORDER BY ${sortColumn} ${dir}
      LIMIT $4 OFFSET $5`,
    [filters.search, filters.status, filters.category, filters.pageSize, (filters.page - 1) * filters.pageSize]
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  const payload: Page<Item> = {
    items: rows.map(toItem),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
  };
  res.json(payload);
});

app.get("/api/contracts/stats", async (_req, res) => {
  const rows = await query<{ status: string; category: string; amount: string }>("SELECT status, category, amount FROM items");
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  let amountTotal = 0;
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    amountTotal += Number(row.amount);
  }
  const stats: Stats = { total: rows.length, amountTotal, byStatus, byCategory };
  res.json(stats);
});

app.get("/api/contracts/:id", async (req, res) => {
  const rows = await query<ItemRow>("SELECT * FROM items WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Contract not found." });
  res.json(toItem(rows[0]));
});

app.post("/api/contracts", async (req, res, next) => {
  try {
    const input = parseItem(req.body);
    const created = await withTransaction(async (client) => {
      const { rows } = await client.query<ItemRow>(
        `INSERT INTO items (title, owner, category, status, amount, priority, due_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [input.title, input.owner, input.category, input.status, input.amount, input.priority, input.dueDate || null, input.notes]
      );
      await client.query("INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, 'created', $2)", [rows[0]!.id, "Created " + input.title]);
      return rows[0]!;
    });
    res.status(201).json(toItem(created));
  } catch (error) {
    next(error);
  }
});

app.put("/api/contracts/:id", async (req, res, next) => {
  try {
    const input = parseItem(req.body);
    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query<ItemRow>(
        `UPDATE items SET title=$1, owner=$2, category=$3, status=$4, amount=$5, priority=$6, due_date=$7, notes=$8, updated_at=now()
          WHERE id=$9 RETURNING *`,
        [input.title, input.owner, input.category, input.status, input.amount, input.priority, input.dueDate || null, input.notes, req.params.id]
      );
      if (!rows[0]) return null;
      await client.query("INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, 'updated', $2)", [req.params.id, "Updated " + input.title]);
      return rows[0];
    });
    if (!updated) return res.status(404).json({ error: "Contract not found." });
    res.json(toItem(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/contracts/:id/status", async (req, res, next) => {
  try {
    const status = String(req.body.status || "");
    if (!STATUSES.includes(status)) throw new ValidationError("Choose a valid status.");
    const rows = await query<ItemRow>("UPDATE items SET status=$1, updated_at=now() WHERE id=$2 RETURNING *", [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Contract not found." });
    await query("INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, 'status', $2)", [req.params.id, "Changed status to " + status]);
    res.json(toItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/contracts/:id", async (req, res) => {
  const rows = await query<{ id: string }>("DELETE FROM items WHERE id=$1 RETURNING id", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Contract not found." });
  res.status(204).send();
});

app.get("/api/contracts/:id/activity", async (req, res) => {
  const rows = await query<ActivityRow>("SELECT * FROM activity_entries WHERE item_id=$1 ORDER BY created_at DESC", [req.params.id]);
  res.json(rows.map(toActivity));
});

app.post("/api/contracts/:id/activity", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body) throw new ValidationError("Activity body is required.");
    const rows = await query<ActivityRow>("INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, $2, $3) RETURNING *", [req.params.id, String(req.body.kind || "note"), body]);
    res.status(201).json(toActivity(rows[0]!));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => console.log("Vendor Contracts API on http://localhost:" + port));

class ValidationError extends Error {}

type ItemRow = {
  id: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  amount: string;
  priority: string;
  due_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  item_id: string;
  kind: string;
  body: string;
  created_at: string;
};

function parseItem(body: Partial<NewItem>): NewItem {
  const item = {
    title: String(body.title || "").trim(),
    owner: String(body.owner || "").trim(),
    category: String(body.category || ""),
    status: String(body.status || ""),
    amount: Number(body.amount || 0),
    priority: String(body.priority || "Medium"),
    dueDate: String(body.dueDate || ""),
    notes: String(body.notes || "").trim()
  };
  if (item.title.length < 2) throw new ValidationError("Title must be at least 2 characters.");
  if (item.owner.length < 2) throw new ValidationError("Owner must be at least 2 characters.");
  if (!STATUSES.includes(item.status)) throw new ValidationError("Choose a valid status.");
  if (!CATEGORIES.includes(item.category)) throw new ValidationError("Choose a valid category.");
  if (!Number.isFinite(item.amount) || item.amount < 0) throw new ValidationError("Amount must be zero or greater.");
  return item;
}

function parseQuery(query: Record<string, unknown>) {
  return {
    search: String(query.search || "").trim(),
    status: String(query.status || "all"),
    category: String(query.category || "all"),
    page: Math.max(1, Number(query.page) || 1),
    pageSize: Math.min(25, Math.max(1, Number(query.pageSize) || 6)),
    sort: String(query.sort || "createdAt"),
    dir: String(query.dir || "desc")
  };
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    category: row.category,
    status: row.status,
    amount: Number(row.amount),
    priority: row.priority,
    dueDate: row.due_date ?? "",
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at
  };
}
