import { pathToFileURL } from "node:url";
import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { pool, query, withTransaction } from "./db.js";
import type {
  Client,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceSummary,
  NewInvoice
} from "../../shared/types.js";

export const app = express();
const port = Number(process.env.PORT ?? 4110);

app.use(cors());
app.use(express.json());
app.param("id",(_req,res,next,value) => { if (!validId(value)) return res.status(400).json({ error: "Use a valid record id." }); next(); });

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid"];

// Postgres returns numeric/uuid columns as strings; normalise to the wire shape.
interface SummaryRow {
  id: string;
  client_id: string;
  client_name: string;
  status: InvoiceStatus;
  issued_date: string;
  tax_rate: string;
  subtotal: string;
}

function toSummary(row: SummaryRow): InvoiceSummary {
  const subtotal = Number(row.subtotal);
  const taxRate = Number(row.tax_rate);
  const tax = Math.round(subtotal * taxRate) / 100;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    status: row.status,
    issuedDate: row.issued_date,
    taxRate,
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100
  };
}

// --- Clients ---------------------------------------------------------------

app.get("/api/clients", asyncRoute(async (_req, res) => {
  const rows = await query<Client>(
    "SELECT id, name, email FROM clients ORDER BY name"
  );
  res.json(rows);
}));

app.post("/api/clients", asyncRoute(async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Name is required." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  const [client] = await query<Client>(
    "INSERT INTO clients (name, email) VALUES ($1, $2) RETURNING id, name, email",
    [name, email]
  );
  res.status(201).json(client);
}));

// --- Invoices --------------------------------------------------------------

app.get("/api/invoices", asyncRoute(async (req, res) => {
  const status = req.query.status;
  const filterByStatus = typeof status === "string" && STATUSES.includes(status as InvoiceStatus);

  // Subtotal is aggregated in SQL with a LEFT JOIN so invoices with no items
  // still show up (COALESCE turns the NULL sum into 0).
  const rows = await query<SummaryRow>(
    `SELECT i.id, i.client_id, c.name AS client_name, i.status,
            to_char(i.issued_date, 'YYYY-MM-DD') AS issued_date,
            i.tax_rate,
            COALESCE(SUM(it.quantity * it.unit_price), 0) AS subtotal
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       LEFT JOIN invoice_items it ON it.invoice_id = i.id
      WHERE ($1::text IS NULL OR i.status = $1)
      GROUP BY i.id, c.name
      ORDER BY i.created_at DESC`,
    [filterByStatus ? status : null]
  );
  res.json(rows.map(toSummary));
}));

app.get("/api/invoices/:id", asyncRoute(async (req, res) => {
  const invoice = await loadInvoice(recordId(req));
  if (!invoice) return res.status(404).json({ error: "Invoice not found." });
  res.json(invoice);
}));

app.post("/api/invoices", asyncRoute(async (req, res, next) => {
  try {
    const input = parseInvoice(req.body);
    // The invoice header and its items must be inserted together or not at all.
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO invoices (client_id, status, issued_date, tax_rate)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.clientId, input.status, input.issuedDate, input.taxRate]
      );
      const invoiceId = rows[0]!.id;
      for (const item of input.items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [invoiceId, item.description, item.quantity, item.unitPrice]
        );
      }
      return invoiceId;
    });
    res.status(201).json(await loadInvoice(id));
  } catch (error) {
    next(error);
  }
}));

app.put("/api/invoices/:id", asyncRoute(async (req, res, next) => {
  try {
    const input = parseInvoice(req.body);
    const updated = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE invoices SET client_id = $2, status = $3, issued_date = $4, tax_rate = $5
          WHERE id = $1`,
        [recordId(req), input.clientId, input.status, input.issuedDate, input.taxRate]
      );
      if (rowCount === 0) return false;
      // Simplest correct approach: replace the line items wholesale.
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [recordId(req)]);
      for (const item of input.items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [recordId(req), item.description, item.quantity, item.unitPrice]
        );
      }
      return true;
    });
    if (!updated) return res.status(404).json({ error: "Invoice not found." });
    res.json(await loadInvoice(recordId(req)));
  } catch (error) {
    next(error);
  }
}));

app.patch("/api/invoices/:id/status", asyncRoute(async (req, res) => {
  const status = req.body.status as InvoiceStatus;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const { rowCount } = await pool.query(
    "UPDATE invoices SET status = $2 WHERE id = $1",
    [recordId(req), status]
  );
  if (rowCount === 0) return res.status(404).json({ error: "Invoice not found." });
  res.json(await loadInvoice(recordId(req)));
}));

app.delete("/api/invoices/:id", asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM invoices WHERE id = $1", [recordId(req)]);
  if (rowCount === 0) return res.status(404).json({ error: "Invoice not found." });
  res.status(204).send();
}));

// Central error handler: validation errors become 400, everything else 500.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (["22P02","23503","23505","23514","22003"].includes((error as { code?: string }).code ?? "")) return res.status(400).json({ error: "Invalid reference or value." });
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Invoice Studio API on http://localhost:${port}`);
});

async function loadInvoice(id: string): Promise<Invoice | null> {
  const [summaryRow] = await query<SummaryRow>(
    `SELECT i.id, i.client_id, c.name AS client_name, i.status,
            to_char(i.issued_date, 'YYYY-MM-DD') AS issued_date,
            i.tax_rate,
            COALESCE(SUM(it.quantity * it.unit_price), 0) AS subtotal
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       LEFT JOIN invoice_items it ON it.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id, c.name`,
    [id]
  );
  if (!summaryRow) return null;

  const itemRows = await query<{
    id: string;
    description: string;
    quantity: number;
    unit_price: string;
  }>(
    "SELECT id, description, quantity, unit_price FROM invoice_items WHERE invoice_id = $1 ORDER BY id",
    [id]
  );

  const items: InvoiceItem[] = itemRows.map((row) => ({
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price)
  }));

  return { ...toSummary(summaryRow), items };
}

class ValidationError extends Error {}

function parseInvoice(body: unknown): NewInvoice {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Send an invoice object.");
  const data = body as Partial<NewInvoice>;
  if (!validId(data.clientId)) throw new ValidationError("Choose a valid client id.");
  if (typeof data.issuedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.issuedDate) || Number.isNaN(Date.parse(data.issuedDate+"T00:00:00Z")) || new Date(data.issuedDate+"T00:00:00Z").toISOString().slice(0,10) !== data.issuedDate)
    throw new ValidationError("Use a real issue date in YYYY-MM-DD format.");
  if (!decimal(data.taxRate,100)) throw new ValidationError("Tax rate must be 0-100 with at most two decimal places.");
  if (!data.clientId) throw new ValidationError("Choose a client.");
  if (!data.status || !STATUSES.includes(data.status)) {
    throw new ValidationError("Choose a valid status.");
  }
  if (!data.issuedDate) throw new ValidationError("An issue date is required.");
  const taxRate = Number(data.taxRate);
  if (!(taxRate >= 0)) throw new ValidationError("Tax rate must be zero or more.");

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0 || items.length > 100) throw new ValidationError("Add at least one line item.");
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.description !== "string" || item.description.length > 500) throw new ValidationError("Each line needs text of at most 500 characters.");
    if (!(typeof item.quantity === "number" || typeof item.quantity === "string") || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) > 1000000 || !decimal(item.unitPrice,9999999999.99)) throw new ValidationError("Use whole quantities and prices with at most two decimal places.");
    if (!item.description?.trim()) throw new ValidationError("Every line needs a description.");
    if (!(Number(item.quantity) > 0)) throw new ValidationError("Quantity must be positive.");
    if (!(Number(item.unitPrice) >= 0)) throw new ValidationError("Unit price must be zero or more.");
  }

  return {
    clientId: data.clientId,
    status: data.status,
    issuedDate: data.issuedDate,
    taxRate,
    items: items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    }))
  };
}

function asyncRoute(handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>): express.RequestHandler {
  return (req,res,next) => { Promise.resolve(handler(req,res,next)).catch(next); };
}

function decimal(value: unknown, maximum: number) { return (typeof value === "number" || typeof value === "string") && /^\d+(?:\.\d{1,2})?$/.test(String(value)) && Number(value) <= maximum; }

function validId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value); }

function recordId(req: express.Request): string { const id = req.params.id; if (!validId(id)) throw new ValidationError("Use a valid record id."); return id; }
