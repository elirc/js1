-- Pulse Analytics schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql
--
-- Raw events are append-only. A materialized view pre-aggregates them per day;
-- the API layers window functions (moving average, running total, LAG) on top.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP MATERIALIZED VIEW IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS events CASCADE;

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (name IN ('view', 'add_to_cart', 'purchase')),
  product     text NOT NULL,
  amount      numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_time ON events(occurred_at);
CREATE INDEX idx_events_name ON events(name);

-- Seed ~4000 events across the last 30 days (~25% purchases).
INSERT INTO events (name, product, amount, occurred_at)
SELECT
  CASE WHEN r < 0.6 THEN 'view' WHEN r < 0.78 THEN 'add_to_cart' ELSE 'purchase' END,
  (ARRAY['Widget', 'Gadget', 'Gizmo', 'Doohickey'])[1 + floor(random() * 4)::int],
  CASE WHEN r >= 0.78 THEN round((10 + random() * 90)::numeric, 2) ELSE 0 END,
  now() - (random() * interval '30 days')
FROM (SELECT random() AS r FROM generate_series(1, 4000)) s;

-- Pre-aggregated per-day rollup. FILTER counts each event type in one pass.
CREATE MATERIALIZED VIEW daily_metrics AS
SELECT
  date_trunc('day', occurred_at)::date AS day,
  COUNT(*) FILTER (WHERE name = 'view')        AS views,
  COUNT(*) FILTER (WHERE name = 'add_to_cart') AS carts,
  COUNT(*) FILTER (WHERE name = 'purchase')    AS orders,
  COALESCE(SUM(amount) FILTER (WHERE name = 'purchase'), 0)::numeric(12, 2) AS revenue
FROM events
GROUP BY 1;

-- A UNIQUE index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX daily_metrics_day ON daily_metrics(day);
