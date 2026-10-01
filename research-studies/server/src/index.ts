import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import { query, withTransaction } from "./db.js";
import type {
  ActivityEntry,
  Item,
  NewItem,
  Page,
  Stats,
} from "../../shared/types.js";

export const app = express();
const port = Number(process.env.PORT ?? 4240);
const STATUSES = ["Design", "Recruiting", "Running", "Analysis", "Complete"];
const CATEGORIES = ["Usability", "Market", "Clinical", "Internal"];
const SORT_COLUMNS: Record<string, string> = {
  title: "title",
  owner: "owner",
  category: "category",
  status: "status",
  amount: "amount",
  priority: "priority",
  dueDate: "due_date",
  createdAt: "created_at",
};

app.use(cors());
app.use(express.json());
app.param("id", (req, res, next, value) => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  )
    return res.status(400).json({ error: "Use a valid record id." });
  next();
});

app.get(
  "/api/studies",
  asyncRoute(async (req, res) => {
    const filters = parseQuery(req.query as Record<string, unknown>);
    const sort = SORT_COLUMNS[filters.sort] ?? "created_at";
    const direction = filters.dir === "asc" ? "ASC" : "DESC";
    const where = `($1 = '' OR to_tsvector('english', title || ' ' || owner || ' ' || category || ' ' || notes) @@ websearch_to_tsquery('english', $1))
    AND ($2 = 'all' OR status = $2) AND ($3 = 'all' OR category = $3)`;
    const payload = await withTransaction(async (client) => {
      await client.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const params = [filters.search, filters.status, filters.category];
      const count = await client.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM items WHERE ${where}`,
        params,
      );
      const total = Number(count.rows[0]!.total),
        totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
      const page = Math.min(filters.page, totalPages);
      const result = await client.query<ItemRow>(
        `SELECT * FROM items WHERE ${where}
      ORDER BY ${sort} ${direction}, id ASC LIMIT $4 OFFSET $5`,
        [...params, filters.pageSize, (page - 1) * filters.pageSize],
      );
      return {
        items: result.rows.map(toItem),
        total,
        totalPages,
        page,
        pageSize: filters.pageSize,
      };
    });
    res.json(payload);
  }),
);

app.get(
  "/api/studies/stats",
  asyncRoute(async (_req, res) => {
    const rows = await query<{
      status: string;
      category: string;
      amount: string;
    }>("SELECT status, category, amount FROM items");
    const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    const byCategory = Object.fromEntries(
      CATEGORIES.map((category) => [category, 0]),
    );
    let amountTotal = 0;
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
      amountTotal += Number(row.amount);
    }
    const stats: Stats = {
      total: rows.length,
      amountTotal,
      byStatus,
      byCategory,
    };
    res.json(stats);
  }),
);

app.get(
  "/api/studies/:id",
  asyncRoute(async (req, res) => {
    const rows = await query<ItemRow>("SELECT * FROM items WHERE id = $1", [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Study not found." });
    res.json(toItem(rows[0]));
  }),
);

app.post(
  "/api/studies",
  asyncRoute(async (req, res, next) => {
    try {
      const input = parseItem(req.body);
      const created = await withTransaction(async (client) => {
        const { rows } = await client.query<ItemRow>(
          `INSERT INTO items (title, owner, category, status, amount, priority, due_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            input.title,
            input.owner,
            input.category,
            input.status,
            input.amount,
            input.priority,
            input.dueDate || null,
            input.notes,
          ],
        );
        await client.query(
          "INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, 'created', $2)",
          [rows[0]!.id, "Created " + input.title],
        );
        return rows[0]!;
      });
      res.status(201).json(toItem(created));
    } catch (error) {
      next(error);
    }
  }),
);

app.put(
  "/api/studies/:id",
  asyncRoute(async (req, res, next) => {
    try {
      const input = parseItem(req.body);
      const updated = await withTransaction(async (client) => {
        const { rows } = await client.query<ItemRow>(
          `UPDATE items SET title=$1, owner=$2, category=$3, status=$4, amount=$5, priority=$6, due_date=$7, notes=$8, updated_at=now()
          WHERE id=$9 RETURNING *`,
          [
            input.title,
            input.owner,
            input.category,
            input.status,
            input.amount,
            input.priority,
            input.dueDate || null,
            input.notes,
            req.params.id,
          ],
        );
        if (!rows[0]) return null;
        await client.query(
          "INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, 'updated', $2)",
          [req.params.id, "Updated " + input.title],
        );
        return rows[0];
      });
      if (!updated) return res.status(404).json({ error: "Study not found." });
      res.json(toItem(updated));
    } catch (error) {
      next(error);
    }
  }),
);

app.patch(
  "/api/studies/:id/status",
  asyncRoute(async (req, res, next) => {
    try {
      const status = req.body?.status;
      if (!STATUSES.includes(status))
        throw new ValidationError("Choose a valid status.");
      const updated = await withTransaction(async (client) => {
        const current = await client.query<ItemRow>(
          "SELECT * FROM items WHERE id=$1 FOR UPDATE",
          [req.params.id],
        );
        if (!current.rows[0]) return null;
        if (current.rows[0].status === status) return current.rows[0];
        const result = await client.query<ItemRow>(
          "UPDATE items SET status=$1, updated_at=now() WHERE id=$2 RETURNING *",
          [status, req.params.id],
        );
        await client.query(
          "INSERT INTO activity_entries (item_id,kind,body) VALUES ($1,'status',$2)",
          [
            req.params.id,
            "Changed status from " + current.rows[0].status + " to " + status,
          ],
        );
        return result.rows[0]!;
      });
      if (!updated) return res.status(404).json({ error: "Record not found." });
      res.json(toItem(updated));
    } catch (error) {
      next(error);
    }
  }),
);

app.delete(
  "/api/studies/:id",
  asyncRoute(async (req, res) => {
    const rows = await query<{ id: string }>(
      "DELETE FROM items WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Study not found." });
    res.status(204).send();
  }),
);

app.get(
  "/api/studies/:id/activity",
  asyncRoute(async (req, res) => {
    const parent = await query("SELECT id FROM items WHERE id=$1", [
      req.params.id,
    ]);
    if (!parent.length)
      return res.status(404).json({ error: "Record not found." });
    const rows = await query<ActivityRow>(
      "SELECT * FROM activity_entries WHERE item_id=$1 ORDER BY created_at DESC, id ASC",
      [req.params.id],
    );
    res.json(rows.map(toActivity));
  }),
);

app.post(
  "/api/studies/:id/activity",
  asyncRoute(async (req, res, next) => {
    try {
      if (
        typeof req.body?.body !== "string" ||
        req.body.body.length > 2000 ||
        (req.body.kind !== undefined &&
          (typeof req.body.kind !== "string" ||
            !req.body.kind.trim() ||
            req.body.kind.length > 40))
      )
        throw new ValidationError(
          "Activity needs text of 1-2000 characters and an optional short kind.",
        );
      const parent = await query("SELECT id FROM items WHERE id=$1", [
        req.params.id,
      ]);
      if (!parent.length)
        return res.status(404).json({ error: "Record not found." });
      const body = req.body.body.trim();
      if (!body) throw new ValidationError("Activity body is required.");
      const rows = await query<ActivityRow>(
        "INSERT INTO activity_entries (item_id, kind, body) VALUES ($1, $2, $3) RETURNING *",
        [req.params.id, String(req.body.kind || "note"), body],
      );
      res.status(201).json(toActivity(rows[0]!));
    } catch (error) {
      next(error);
    }
  }),
);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ValidationError)
      return res.status(400).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "Something went wrong." });
  },
);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  app.listen(port, () =>
    console.log("Research Studies API on http://localhost:" + port),
  );

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
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ValidationError("Send a record object.");
  if (
    (["title", "owner"] as const).some(
      (key) => typeof body[key] !== "string" || body[key].trim().length > 200,
    ) ||
    (["category", "status", "notes", "priority", "dueDate"] as const).some(
      (key) => body[key] !== undefined && typeof body[key] !== "string",
    )
  )
    throw new ValidationError(
      "Use text fields; title and owner allow at most 200 characters.",
    );
  if (
    body.amount !== undefined &&
    ((typeof body.amount !== "number" && typeof body.amount !== "string") ||
      String(body.amount).trim() === "")
  )
    throw new ValidationError("Amount must be a number.");
  if (body.dueDate && !validDate(body.dueDate))
    throw new ValidationError("Use a real date in YYYY-MM-DD format.");
  if (
    (body.notes?.length ?? 0) > 10000 ||
    (body.priority &&
      !["Low", "Medium", "High", "Critical"].includes(body.priority))
  )
    throw new ValidationError(
      "Choose a valid priority and keep notes under 10000 characters.",
    );
  const item = {
    title: String(body.title || "").trim(),
    owner: String(body.owner || "").trim(),
    category: String(body.category || ""),
    status: String(body.status || ""),
    amount: Number(body.amount || 0),
    priority: String(body.priority || "Medium"),
    dueDate: String(body.dueDate || ""),
    notes: String(body.notes || "").trim(),
  };
  if (item.title.length < 2)
    throw new ValidationError("Title must be at least 2 characters.");
  if (item.owner.length < 2)
    throw new ValidationError("Owner must be at least 2 characters.");
  if (!STATUSES.includes(item.status))
    throw new ValidationError("Choose a valid status.");
  if (!CATEGORIES.includes(item.category))
    throw new ValidationError("Choose a valid category.");
  if (
    !Number.isFinite(item.amount) ||
    item.amount < 0 ||
    item.amount > 9999999999.99
  )
    throw new ValidationError("Amount must be zero or greater.");
  return item;
}

function parseQuery(query: Record<string, unknown>) {
  return {
    search: String(query.search || "").trim(),
    status: String(query.status || "all"),
    category: String(query.category || "all"),
    page: pageNumber(query.page, 1, 1000000),
    pageSize: pageNumber(query.pageSize, 6, 25),
    sort: String(query.sort || "createdAt"),
    dir: String(query.dir || "desc"),
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
    updatedAt: row.updated_at,
  };
}

function toActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

function asyncRoute(
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => Promise<unknown>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
function pageNumber(value: unknown, fallback: number, maximum: number) {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number > 0
    ? Math.min(number, maximum)
    : fallback;
}
