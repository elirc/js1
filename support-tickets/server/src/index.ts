import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import type { PoolClient } from "pg";
import { pool, query, withTransaction } from "./db.js";
import type {
  Agent,
  Label,
  NewTicket,
  Ticket,
  TicketEvent,
  TicketPriority,
  TicketStatus
} from "../../shared/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4111);

app.use(cors());
app.use(express.json());

const STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

// json_agg returns parsed JSON, so labels arrive as an array already.
interface TicketRow {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  labels: Label[];
  created_at: string;
  updated_at: string;
}

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee_id
      ? { id: row.assignee_id, name: row.assignee_name ?? "", email: row.assignee_email ?? "" }
      : null,
    labels: row.labels,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const TICKET_SELECT = `
  SELECT t.id, t.subject, t.body, t.status, t.priority,
         a.id AS assignee_id, a.name AS assignee_name, a.email AS assignee_email,
         COALESCE(
           json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                    ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL),
           '[]'
         ) AS labels,
         t.created_at, t.updated_at
    FROM tickets t
    LEFT JOIN agents a ON a.id = t.assignee_id
    LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
    LEFT JOIN labels l ON l.id = tl.label_id
`;

// --- Reference data --------------------------------------------------------

app.get("/api/agents", async (_req, res) => {
  res.json(await query<Agent>("SELECT id, name, email FROM agents ORDER BY name"));
});

app.get("/api/labels", async (_req, res) => {
  res.json(await query<Label>("SELECT id, name, color FROM labels ORDER BY name"));
});

// --- Tickets ---------------------------------------------------------------

app.get("/api/tickets", async (req, res) => {
  const status = asEnum(req.query.status, STATUSES);
  const priority = asEnum(req.query.priority, PRIORITIES);
  const labelId = typeof req.query.label === "string" ? req.query.label : null;
  const assigneeId = typeof req.query.assignee === "string" ? req.query.assignee : null;
  const search = typeof req.query.search === "string" ? req.query.search : "";

  const rows = await query<TicketRow>(
    `${TICKET_SELECT}
      WHERE ($1::text IS NULL OR t.status = $1)
        AND ($2::text IS NULL OR t.priority = $2)
        AND ($3::uuid IS NULL OR t.assignee_id = $3)
        AND ($4 = '' OR t.subject ILIKE '%' || $4 || '%' OR t.body ILIKE '%' || $4 || '%')
        AND ($5::uuid IS NULL OR EXISTS (
              SELECT 1 FROM ticket_labels x WHERE x.ticket_id = t.id AND x.label_id = $5))
      GROUP BY t.id, a.id
      ORDER BY t.created_at DESC`,
    [status, priority, assigneeId, search, labelId]
  );
  res.json(rows.map(toTicket));
});

app.get("/api/tickets/:id", async (req, res) => {
  const ticket = await loadTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found." });
  res.json(ticket);
});

app.get("/api/tickets/:id/events", async (req, res) => {
  const events = await query<{ id: string; kind: string; detail: string; created_at: string }>(
    "SELECT id, kind, detail, created_at FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC",
    [req.params.id]
  );
  const payload: TicketEvent[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    detail: e.detail,
    createdAt: e.created_at
  }));
  res.json(payload);
});

app.post("/api/tickets", async (req, res, next) => {
  try {
    const input = parseTicket(req.body);
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO tickets (subject, body, priority, assignee_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.subject, input.body, input.priority, input.assigneeId]
      );
      const ticketId = rows[0]!.id;
      await linkLabels(client, ticketId, input.labelIds);
      await logEvent(client, ticketId, "created", "Ticket opened");
      return ticketId;
    });
    res.status(201).json(await loadTicket(id));
  } catch (error) {
    next(error);
  }
});

app.put("/api/tickets/:id", async (req, res, next) => {
  try {
    const input = parseTicket(req.body);
    const ok = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE tickets
            SET subject = $2, body = $3, priority = $4, assignee_id = $5, updated_at = now()
          WHERE id = $1`,
        [req.params.id, input.subject, input.body, input.priority, input.assigneeId]
      );
      if (rowCount === 0) return false;
      await client.query("DELETE FROM ticket_labels WHERE ticket_id = $1", [req.params.id]);
      await linkLabels(client, req.params.id, input.labelIds);
      await logEvent(client, req.params.id, "edited", "Ticket details updated");
      return true;
    });
    if (!ok) return res.status(404).json({ error: "Ticket not found." });
    res.json(await loadTicket(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/status", async (req, res, next) => {
  try {
    const status = asEnum(req.body.status, STATUSES);
    if (!status) return res.status(400).json({ error: "Invalid status." });
    const ok = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        "UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1",
        [req.params.id, status]
      );
      if (rowCount === 0) return false;
      await logEvent(client, req.params.id, "status", `Status changed to ${status}`);
      return true;
    });
    if (!ok) return res.status(404).json({ error: "Ticket not found." });
    res.json(await loadTicket(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/assignee", async (req, res, next) => {
  try {
    const assigneeId = req.body.assigneeId === null ? null : String(req.body.assigneeId);
    const ok = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        "UPDATE tickets SET assignee_id = $2, updated_at = now() WHERE id = $1",
        [req.params.id, assigneeId]
      );
      if (rowCount === 0) return false;
      const detail = assigneeId ? "Assigned to an agent" : "Unassigned";
      await logEvent(client, req.params.id, "assignment", detail);
      return true;
    });
    if (!ok) return res.status(404).json({ error: "Ticket not found." });
    res.json(await loadTicket(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tickets/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM tickets WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Ticket not found." });
  res.status(204).send();
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
  console.log(`Support Tickets API on http://localhost:${port}`);
});

async function loadTicket(id: string): Promise<Ticket | null> {
  const rows = await query<TicketRow>(
    `${TICKET_SELECT} WHERE t.id = $1 GROUP BY t.id, a.id`,
    [id]
  );
  return rows[0] ? toTicket(rows[0]) : null;
}

async function linkLabels(client: PoolClient, ticketId: string, labelIds: string[]) {
  for (const labelId of labelIds) {
    await client.query(
      "INSERT INTO ticket_labels (ticket_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [ticketId, labelId]
    );
  }
}

async function logEvent(client: PoolClient, ticketId: string, kind: string, detail: string) {
  await client.query(
    "INSERT INTO ticket_events (ticket_id, kind, detail) VALUES ($1, $2, $3)",
    [ticketId, kind, detail]
  );
}

class ValidationError extends Error {}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function parseTicket(body: unknown): NewTicket {
  const data = body as Partial<NewTicket>;
  const subject = (data.subject ?? "").trim();
  if (subject.length < 3) throw new ValidationError("Subject must be at least 3 characters.");
  const priority = asEnum(data.priority, PRIORITIES);
  if (!priority) throw new ValidationError("Choose a valid priority.");
  const labelIds = Array.isArray(data.labelIds) ? data.labelIds.map(String) : [];
  return {
    subject,
    body: (data.body ?? "").trim(),
    priority,
    assigneeId: data.assigneeId ? String(data.assigneeId) : null,
    labelIds
  };
}
