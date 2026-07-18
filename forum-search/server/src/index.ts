import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool, query, withTransaction } from "./db.js";
import type { NewThread, Tag, Thread, ThreadPage, ThreadSummary, User } from "../../shared/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4114);

app.use(cors());
app.use(express.json());

app.get("/api/users", async (_req, res) => {
  res.json(await query<User>("SELECT id, username FROM users ORDER BY username"));
});

app.get("/api/tags", async (_req, res) => {
  const rows = await query<{ name: string; count: string }>(
    `SELECT tg.name, COUNT(tt.thread_id) AS count
       FROM tags tg
       LEFT JOIN thread_tags tt ON tt.tag_id = tg.id
      GROUP BY tg.name
      ORDER BY tg.name`
  );
  const tags: Tag[] = rows.map((row) => ({ name: row.name, count: Number(row.count) }));
  res.json(tags);
});

// Full-text search + tag filter + pagination, all in one query.
// COUNT(*) OVER() gives the total match count before LIMIT/OFFSET, so we
// avoid a second round-trip just to count.
app.get("/api/threads", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag : "";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(20, Math.max(1, Number(req.query.pageSize) || 5));
  const offset = (page - 1) * pageSize;

  const rows = await query<{
    id: string;
    title: string;
    author: string;
    snippet: string;
    created_at: string;
    tags: string[];
    total: string;
  }>(
    `SELECT t.id, t.title, u.username AS author,
            ts_headline('english', t.body, websearch_to_tsquery('english', $1),
                        'StartSel=[[, StopSel=]], MaxFragments=1, MaxWords=26, MinWords=10') AS snippet,
            to_char(t.created_at, 'YYYY-MM-DD') AS created_at,
            COALESCE(json_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), '[]') AS tags,
            COUNT(*) OVER() AS total
       FROM threads t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN thread_tags tt ON tt.thread_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE ($1 = '' OR t.search @@ websearch_to_tsquery('english', $1))
        AND ($2 = '' OR EXISTS (
              SELECT 1 FROM thread_tags x JOIN tags y ON y.id = x.tag_id
               WHERE x.thread_id = t.id AND y.name = $2))
      GROUP BY t.id, u.username
      ORDER BY ts_rank(t.search, websearch_to_tsquery('english', $1)) DESC, t.created_at DESC
      LIMIT $3 OFFSET $4`,
    [q, tag, pageSize, offset]
  );

  const total = rows[0] ? Number(rows[0].total) : 0;
  const items: ThreadSummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    snippet: row.snippet,
    createdAt: row.created_at,
    tags: row.tags
  }));

  const payload: ThreadPage = {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
  res.json(payload);
});

app.get("/api/threads/:id", async (req, res) => {
  const rows = await query<{
    id: string;
    title: string;
    body: string;
    author: string;
    created_at: string;
    tags: string[];
  }>(
    `SELECT t.id, t.title, t.body, u.username AS author,
            to_char(t.created_at, 'YYYY-MM-DD') AS created_at,
            COALESCE(json_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), '[]') AS tags
       FROM threads t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN thread_tags tt ON tt.thread_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE t.id = $1
      GROUP BY t.id, u.username`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Thread not found." });
  const thread: Thread = { ...rows[0], createdAt: rows[0].created_at };
  res.json(thread);
});

app.post("/api/threads", async (req, res, next) => {
  try {
    const input = parseThread(req.body);
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO threads (title, body, author_id) VALUES ($1, $2, $3) RETURNING id",
        [input.title, input.body, input.authorId]
      );
      const threadId = rows[0]!.id;
      for (const name of input.tagNames) {
        // Upsert the tag, then link it. ON CONFLICT makes both steps idempotent.
        await client.query("INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
        await client.query(
          `INSERT INTO thread_tags (thread_id, tag_id)
           SELECT $1, id FROM tags WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [threadId, name]
        );
      }
      return threadId;
    });
    const created = await query<Thread>("SELECT id FROM threads WHERE id = $1", [id]);
    res.status(201).json(created[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/threads/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM threads WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Thread not found." });
  res.status(204).send();
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
  console.log(`Forum Search API on http://localhost:${port}`);
});

class ValidationError extends Error {}

function parseThread(body: unknown): NewThread {
  const data = body as Partial<NewThread>;
  const title = (data.title ?? "").trim();
  if (title.length < 3) throw new ValidationError("Title must be at least 3 characters.");
  if (!data.authorId) throw new ValidationError("Choose an author.");
  const tagNames = Array.isArray(data.tagNames)
    ? [...new Set(data.tagNames.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
    : [];
  return { title, body: (data.body ?? "").trim(), authorId: data.authorId, tagNames };
}
