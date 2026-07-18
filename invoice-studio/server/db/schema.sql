-- Invoice Studio schema. Run once: psql "$DATABASE_URL" -f server/db/schema.sql
-- Safe to re-run: it drops and recreates everything.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  tax_rate    numeric(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);

-- Seed data
WITH seeded_clients AS (
  INSERT INTO clients (name, email) VALUES
    ('Northwind Co', 'ap@northwind.example'),
    ('Acme LLC', 'billing@acme.example')
  RETURNING id, name
), seeded_invoice AS (
  INSERT INTO invoices (client_id, status, tax_rate)
  SELECT id, 'sent', 8.50 FROM seeded_clients WHERE name = 'Northwind Co'
  RETURNING id
)
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
SELECT id, 'Design retainer', 1, 1800.00 FROM seeded_invoice
UNION ALL
SELECT id, 'Hosting (months)', 3, 45.00 FROM seeded_invoice;
