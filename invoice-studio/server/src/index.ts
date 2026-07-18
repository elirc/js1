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

const app = express();
const port = Number(process.env.PORT ?? 4110);

app.use(cors());
app.use(express.json());

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
    total: subtotal + tax
  };
}

// --- Clients ---------------------------------------------------------------

app.get("/api/clients", async (_req, res) => {
  const rows = await query<Client>(
    "SELECT id, name, email FROM clients ORDER BY name"
  );
  res.json(rows);
});

app.post("/api/clients", async (req, res) => {
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
});

// --- Invoices --------------------------------------------------------------

app.get("/api/invoices", async (req, res) => {
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
});

app.get("/api/invoices/:id", async (req, res) => {
  const invoice = await loadInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found." });
  res.json(invoice);
});

app.post("/api/invoices", async (req, res, next) => {
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
});

app.put("/api/invoices/:id", async (req, res, next) => {
  try {
    const input = parseInvoice(req.body);
    const updated = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE invoices SET client_id = $2, status = $3, issued_date = $4, tax_rate = $5
          WHERE id = $1`,
        [req.params.id, input.clientId, input.status, input.issuedDate, input.taxRate]
      );
      if (rowCount === 0) return false;
      // Simplest correct approach: replace the line items wholesale.
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [req.params.id]);
      for (const item of input.items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [req.params.id, item.description, item.quantity, item.unitPrice]
        );
      }
      return true;
    });
    if (!updated) return res.status(404).json({ error: "Invoice not found." });
    res.json(await loadInvoice(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/invoices/:id/status", async (req, res) => {
  const status = req.body.status as InvoiceStatus;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const { rowCount } = await pool.query(
    "UPDATE invoices SET status = $2 WHERE id = $1",
    [req.params.id, status]
  );
  if (rowCount === 0) return res.status(404).json({ error: "Invoice not found." });
  res.json(await loadInvoice(req.params.id));
});

app.delete("/api/invoices/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM invoices WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Invoice not found." });
  res.status(204).send();
});

// Central error handler: validation errors become 400, everything else 500.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
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
  const data = body as Partial<NewInvoice>;
  if (!data.clientId) throw new ValidationError("Choose a client.");
  if (!data.status || !STATUSES.includes(data.status)) {
    throw new ValidationError("Choose a valid status.");
  }
  if (!data.issuedDate) throw new ValidationError("An issue date is required.");
  const taxRate = Number(data.taxRate);
  if (!(taxRate >= 0)) throw new ValidationError("Tax rate must be zero or more.");

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) throw new ValidationError("Add at least one line item.");
  for (const item of items) {
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
