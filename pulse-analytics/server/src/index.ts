import { pathToFileURL } from "node:url";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool, query } from "./db.js";
import type { DailyMetric, EventName, Freshness, NewEvent, Summary, TopProduct } from "../../shared/types.js";

export const app = express();
const port = Number(process.env.PORT ?? 4117);

app.use(cors());
app.use(express.json());

const EVENT_NAMES: EventName[] = ["view", "add_to_cart", "purchase"];

function clampDays(value: unknown): number {
  const n = Number(value) || 30;
  return Math.min(365, Math.max(1, Math.trunc(n)));
}

// Daily series, read from the materialized view, with window functions layered
// on: a 7-day moving average, a running total, and the day-over-day delta.
app.get("/api/metrics/daily", asyncRoute(async (req, res) => {
  const days = clampDays(req.query.days);
  const rows = await query<{
    day: string;
    views: string;
    carts: string;
    orders: string;
    revenue: string;
    revenue_ma7: string;
    revenue_cumulative: string;
    revenue_delta: string | null;
  }>(
    `WITH calendar AS (
       SELECT generated::date AS day FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') generated
     ), filled AS (
       SELECT c.day, COALESCE(m.views,0) AS views, COALESCE(m.carts,0) AS carts,
         COALESCE(m.orders,0) AS orders, COALESCE(m.revenue,0) AS revenue
       FROM calendar c LEFT JOIN daily_metrics m ON m.day=c.day
     )
     SELECT to_char(day,'YYYY-MM-DD') AS day, views, carts, orders, revenue,
       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW),2) AS revenue_ma7,
       SUM(revenue) OVER (ORDER BY day) AS revenue_cumulative,
       revenue - LAG(revenue) OVER (ORDER BY day) AS revenue_delta
     FROM filled ORDER BY day`,
    [days]
  );

  const metrics: DailyMetric[] = rows.map((row) => ({
    day: row.day,
    views: Number(row.views),
    carts: Number(row.carts),
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    revenueMa7: Number(row.revenue_ma7),
    revenueCumulative: Number(row.revenue_cumulative),
    revenueDelta: row.revenue_delta === null ? null : Number(row.revenue_delta)
  }));
  res.json(metrics);
}));

app.get("/api/metrics/summary", asyncRoute(async (req, res) => {
  const days = clampDays(req.query.days);
  const [row] = await query<{ views: string; carts: string; orders: string; revenue: string }>(
    `SELECT COALESCE(SUM(views), 0) AS views,
            COALESCE(SUM(carts), 0) AS carts,
            COALESCE(SUM(orders), 0) AS orders,
            COALESCE(SUM(revenue), 0) AS revenue
       FROM daily_metrics
      WHERE day >= CURRENT_DATE - ($1::int - 1) AND day <= CURRENT_DATE`,
    [days]
  );
  const views = Number(row?.views ?? 0);
  const orders = Number(row?.orders ?? 0);
  const revenue = Number(row?.revenue ?? 0);
  const summary: Summary = {
    days,
    views,
    carts: Number(row?.carts ?? 0),
    orders,
    revenue,
    conversion: views === 0 ? 0 : orders / views,
    avgOrderValue: orders === 0 ? 0 : revenue / orders
  };
  res.json(summary);
}));

// Ranked from RAW events (not the matview) so it always reflects the latest
// data; RANK() assigns the leaderboard position.
app.get("/api/metrics/top-products", asyncRoute(async (req, res) => {
  const days = clampDays(req.query.days);
  const limit = Math.min(20, Math.max(1, Math.trunc(Number(req.query.limit)) || 5));
  const rows = await query<{ product: string; orders: string; revenue: string; rank: string }>(
    `SELECT product,
            COUNT(*) FILTER (WHERE name = 'purchase') AS orders,
            COALESCE(SUM(amount) FILTER (WHERE name = 'purchase'), 0) AS revenue,
            RANK() OVER (ORDER BY COALESCE(SUM(amount) FILTER (WHERE name = 'purchase'), 0) DESC) AS rank
       FROM events
      WHERE occurred_at >= now() - ($1::int * interval '1 day')
      GROUP BY product
      ORDER BY revenue DESC
      LIMIT $2`,
    [days, limit]
  );
  const top: TopProduct[] = rows.map((row) => ({
    product: row.product,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    rank: Number(row.rank)
  }));
  res.json(top);
}));

// How far behind is the materialized view? Compare raw event count with the
// number of events represented in the rollup.
app.get("/api/metrics/freshness", asyncRoute(async (_req, res) => {
  res.json(await freshness());
}));

app.post("/api/events", asyncRoute(async (req, res, next) => {
  try {
    const input = parseEvent(req.body);
    await query("INSERT INTO events (name, product, amount) VALUES ($1, $2, $3)", [
      input.name,
      input.product,
      input.amount
    ]);
    res.status(201).json(await freshness());
  } catch (error) {
    next(error);
  }
}));

// Inject a burst of recent events so the "view is stale" state is easy to see.
app.post("/api/events/sample", asyncRoute(async (_req, res) => {
  await query(
    `INSERT INTO events (name, product, amount, occurred_at)
     SELECT
       CASE WHEN r < 0.6 THEN 'view' WHEN r < 0.78 THEN 'add_to_cart' ELSE 'purchase' END,
       (ARRAY['Widget', 'Gadget', 'Gizmo', 'Doohickey'])[1 + floor(random() * 4)::int],
       CASE WHEN r >= 0.78 THEN round((10 + random() * 90)::numeric, 2) ELSE 0 END,
       now() - (random() * interval '2 days')
     FROM (SELECT random() AS r FROM generate_series(1, 250)) s`
  );
  res.status(201).json(await freshness());
}));

// CONCURRENTLY does not block readers; it needs the unique index we created.
app.post("/api/metrics/refresh", asyncRoute(async (_req, res) => {
  // Two overlapping CONCURRENTLY refreshes queue on the view's lock; bound the wait and
  // answer 409 instead of hanging the request (55P03 = lock_not_available).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if ((error as { code?: string }).code === "55P03") {
      client.release();
      return res.status(409).json({ error: "A refresh is already running; try again shortly." });
    }
    client.release();
    throw error;
  }
  client.release();
  res.json(await freshness());
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Pulse Analytics API on http://localhost:${port}`);
});

async function freshness(): Promise<Freshness> {
  const [row] = await query<{ total: string; in_view: string }>(
    `SELECT (SELECT COUNT(*) FROM events) AS total,
            (SELECT COALESCE(SUM(views + carts + orders), 0) FROM daily_metrics) AS in_view`
  );
  const totalEvents = Number(row?.total ?? 0);
  const viewEvents = Number(row?.in_view ?? 0);
  return { totalEvents, viewEvents, stale: totalEvents !== viewEvents };
}

class ValidationError extends Error {}

function parseEvent(body: unknown): NewEvent {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Send an event object.");
  const data = body as Partial<NewEvent>;
  // Vocabulary first: every later rule depends on which event this is.
  if (!data.name || !EVENT_NAMES.includes(data.name)) {
    throw new ValidationError("name must be view, add_to_cart, or purchase.");
  }
  if (typeof data.product !== "string" || data.product.length > 200) throw new ValidationError("Use a product name of at most 200 characters.");
  if (data.name === "purchase" && (typeof data.amount !== "number" && typeof data.amount !== "string" || String(data.amount).trim() === "")) throw new ValidationError("Purchase amount must be a number.");
  const product = (data.product ?? "").trim();
  if (!product) throw new ValidationError("product is required.");
  const amount = data.name === "purchase" ? Number(data.amount) : 0;
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) throw new ValidationError("amount must be zero or more.");
  return { name: data.name, product, amount };
}

function asyncRoute(handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>): express.RequestHandler {
  return (req,res,next) => { Promise.resolve(handler(req,res,next)).catch(next); };
}
