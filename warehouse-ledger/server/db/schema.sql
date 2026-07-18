-- Warehouse Ledger schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql
--
-- Stock is never stored as a single mutable number. Instead every change is an
-- immutable movement (+received / -issued), and the balance is SUM(delta).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text NOT NULL UNIQUE,
  name          text NOT NULL,
  reorder_point integer NOT NULL DEFAULT 0 CHECK (reorder_point >= 0)
);

CREATE TABLE warehouses (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  delta        integer NOT NULL CHECK (delta <> 0),
  reason       text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_balance ON movements(product_id, warehouse_id);

-- Seed data
INSERT INTO products (sku, name, reorder_point) VALUES
  ('SKU-001', 'USB-C Cable', 25),
  ('SKU-002', 'Laptop Stand', 10),
  ('SKU-003', 'Webcam 1080p', 8);

INSERT INTO warehouses (name) VALUES
  ('Main'),
  ('Overflow');

-- Opening balances as initial "received" movements.
INSERT INTO movements (product_id, warehouse_id, delta, reason)
SELECT p.id, w.id, 40, 'Opening stock'
FROM products p, warehouses w
WHERE p.sku = 'SKU-001' AND w.name = 'Main';

INSERT INTO movements (product_id, warehouse_id, delta, reason)
SELECT p.id, w.id, 5, 'Opening stock'
FROM products p, warehouses w
WHERE p.sku = 'SKU-002' AND w.name = 'Main';
