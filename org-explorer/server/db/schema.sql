-- Org Explorer schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql
--
-- A classic adjacency list: every node points at its parent. The hierarchy is
-- read back out with WITH RECURSIVE queries (see server/src/index.ts).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS nodes CASCADE;

CREATE TABLE nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES nodes(id) ON DELETE CASCADE,
  name       text NOT NULL,
  title      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nodes_parent ON nodes(parent_id);

-- Seed a small org chart.
WITH ceo AS (
  INSERT INTO nodes (parent_id, name, title) VALUES (NULL, 'Dana', 'CEO') RETURNING id
), vps AS (
  INSERT INTO nodes (parent_id, name, title)
  SELECT id, v.name, v.title FROM ceo, (VALUES
    ('Morgan', 'VP Engineering'),
    ('Priya', 'VP Sales')
  ) AS v(name, title)
  RETURNING id, name
)
INSERT INTO nodes (parent_id, name, title)
SELECT id, m.name, m.title FROM vps, (VALUES
  ('VP Engineering', 'Lee', 'Eng Manager'),
  ('VP Engineering', 'Sam', 'Staff Engineer'),
  ('VP Sales', 'Chris', 'Account Exec')
) AS m(under, name, title)
WHERE (vps.name = 'Morgan' AND m.under = 'VP Engineering')
   OR (vps.name = 'Priya' AND m.under = 'VP Sales');
