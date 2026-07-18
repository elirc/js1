CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS activity_entries;
DROP TABLE IF EXISTS items;

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) >= 2),
  owner text NOT NULL CHECK (length(trim(owner)) >= 2),
  category text NOT NULL,
  status text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  priority text NOT NULL DEFAULT 'Medium',
  due_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX items_search_idx ON items USING gin (to_tsvector('english', title || ' ' || owner || ' ' || category || ' ' || notes));
CREATE INDEX items_status_idx ON items(status);
CREATE INDEX items_category_idx ON items(category);
CREATE INDEX activity_entries_item_idx ON activity_entries(item_id, created_at DESC);

INSERT INTO items (title, owner, category, status, amount, priority, due_date, notes)
SELECT title, owner, category, status, amount, priority, due_date::date, notes
FROM json_to_recordset('[{"owner":"Sam Rivera","dueDate":"2026-09-01","title":"Junior Backend Ramp","category":"Backend","amount":600,"status":"In Progress","priority":"High","notes":"Focus on APIs and SQL."},{"owner":"Avery Stone","dueDate":"2026-08-20","title":"React Fundamentals","category":"Frontend","amount":300,"status":"Planned","priority":"Medium","notes":"Pair with issue desk project."}]'::json) AS x(title text, owner text, category text, status text, amount numeric, priority text, due_date text, notes text);

INSERT INTO activity_entries (item_id, kind, body)
SELECT id, 'created', 'Seeded ' || title FROM items;
