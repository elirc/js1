import "dotenv/config";
import express from "express";
import cors from "cors";
import type { PoolClient } from "pg";
import { pool, query, withTransaction } from "./db.js";
import type {
  Movement,
  NewMovement,
  Product,
  StockLevel,
  Transfer,
  Warehouse
} from "../../shared/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4113);

app.use(cors());
app.use(express.json());

app.get("/api/products", async (_req, res) => {
  res.json(
    await query<Product>(
      "SELECT id, sku, name, reorder_point AS \"reorderPoint\" FROM products ORDER BY name"
    )
  );
});

app.get("/api/warehouses", async (_req, res) => {
  res.json(await query<Warehouse>("SELECT id, name FROM warehouses ORDER BY name"));
});

// Balances are derived: every product × warehouse pair, with COALESCE(SUM,0).
app.get("/api/stock", async (req, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : null;
  const warehouseId = typeof req.query.warehouseId === "string" ? req.query.warehouseId : null;

  const rows = await query<{
    productId: string;
    sku: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    balance: string;
    reorderPoint: number;
  }>(
    `SELECT p.id AS "productId", p.sku, p.name AS "productName",
            w.id AS "warehouseId", w.name AS "warehouseName",
            COALESCE(SUM(m.delta), 0) AS balance,
            p.reorder_point AS "reorderPoint"
       FROM products p
       CROSS JOIN warehouses w
       LEFT JOIN movements m ON m.product_id = p.id AND m.warehouse_id = w.id
      WHERE ($1::uuid IS NULL OR p.id = $1)
        AND ($2::uuid IS NULL OR w.id = $2)
      GROUP BY p.id, w.id
      ORDER BY p.name, w.name`,
    [productId, warehouseId]
  );

  const stock: StockLevel[] = rows.map((row) => {
    const balance = Number(row.balance);
    return {
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      balance,
      reorderPoint: row.reorderPoint,
      low: balance <= row.reorderPoint
    };
  });
  res.json(stock);
});

app.get("/api/products/:id/ledger", async (req, res) => {
  const warehouseId = typeof req.query.warehouseId === "string" ? req.query.warehouseId : null;
  const rows = await query<{
    id: string;
    product_id: string;
    warehouse_id: string;
    warehouse_name: string;
    delta: number;
    reason: string;
    created_at: string;
  }>(
    `SELECT m.id, m.product_id, m.warehouse_id, w.name AS warehouse_name,
            m.delta, m.reason, m.created_at
       FROM movements m
       JOIN warehouses w ON w.id = m.warehouse_id
      WHERE m.product_id = $1 AND ($2::uuid IS NULL OR m.warehouse_id = $2)
      ORDER BY m.created_at DESC
      LIMIT 100`,
    [req.params.id, warehouseId]
  );
  const ledger: Movement[] = rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
    delta: row.delta,
    reason: row.reason,
    createdAt: row.created_at
  }));
  res.json(ledger);
});

// A single adjustment: positive = receive, negative = issue. Issuing below
// zero is rejected inside a transaction so the balance never goes negative.
app.post("/api/movements", async (req, res, next) => {
  try {
    const input = parseMovement(req.body);
    await withTransaction(async (client) => {
      if (input.delta < 0) {
        const balance = await balanceOf(client, input.productId, input.warehouseId);
        if (balance + input.delta < 0) {
          throw new ValidationError(`Only ${balance} on hand — cannot issue ${-input.delta}.`);
        }
      }
      await client.query(
        "INSERT INTO movements (product_id, warehouse_id, delta, reason) VALUES ($1, $2, $3, $4)",
        [input.productId, input.warehouseId, input.delta, input.reason]
      );
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// A transfer is two movements that MUST both succeed: debit the source,
// credit the destination, all in one transaction.
app.post("/api/transfers", async (req, res, next) => {
  try {
    const input = parseTransfer(req.body);
    await withTransaction(async (client) => {
      const balance = await balanceOf(client, input.productId, input.fromWarehouseId);
      if (balance < input.quantity) {
        throw new ValidationError(`Source has only ${balance} on hand — cannot transfer ${input.quantity}.`);
      }
      const reason = input.reason || "Transfer";
      await client.query(
        "INSERT INTO movements (product_id, warehouse_id, delta, reason) VALUES ($1, $2, $3, $4)",
        [input.productId, input.fromWarehouseId, -input.quantity, reason]
      );
      await client.query(
        "INSERT INTO movements (product_id, warehouse_id, delta, reason) VALUES ($1, $2, $3, $4)",
        [input.productId, input.toWarehouseId, input.quantity, reason]
      );
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
  console.log(`Warehouse Ledger API on http://localhost:${port}`);
});

async function balanceOf(client: PoolClient, productId: string, warehouseId: string): Promise<number> {
  const { rows } = await client.query<{ balance: string }>(
    "SELECT COALESCE(SUM(delta), 0) AS balance FROM movements WHERE product_id = $1 AND warehouse_id = $2",
    [productId, warehouseId]
  );
  return Number(rows[0]!.balance);
}

class ValidationError extends Error {}

function parseMovement(body: unknown): NewMovement {
  const data = body as Partial<NewMovement>;
  if (!data.productId) throw new ValidationError("Choose a product.");
  if (!data.warehouseId) throw new ValidationError("Choose a warehouse.");
  const delta = Math.trunc(Number(data.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    throw new ValidationError("Quantity must be a non-zero whole number.");
  }
  return { productId: data.productId, warehouseId: data.warehouseId, delta, reason: (data.reason ?? "").trim() };
}

function parseTransfer(body: unknown): Transfer {
  const data = body as Partial<Transfer>;
  if (!data.productId) throw new ValidationError("Choose a product.");
  if (!data.fromWarehouseId || !data.toWarehouseId) throw new ValidationError("Choose both warehouses.");
  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new ValidationError("Source and destination must differ.");
  }
  const quantity = Math.trunc(Number(data.quantity));
  if (!(quantity > 0)) throw new ValidationError("Transfer quantity must be positive.");
  return {
    productId: data.productId,
    fromWarehouseId: data.fromWarehouseId,
    toWarehouseId: data.toWarehouseId,
    quantity,
    reason: (data.reason ?? "").trim()
  };
}
