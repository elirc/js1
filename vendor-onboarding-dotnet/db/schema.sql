CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS activity_entries;
DROP TABLE IF EXISTS work_items;

CREATE TABLE work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  owner text NOT NULL CHECK (length(trim(owner)) > 0),
  category text NOT NULL CHECK (category IN ('Software', 'Facilities', 'Professional Services', 'Logistics')),
  status text NOT NULL CHECK (status IN ('Invited', 'Documents Pending', 'Security Review', 'Approved', 'Rejected')),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  due_date date,
  notes text NOT NULL DEFAULT '',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(owner, '') || ' ' || coalesce(category, '') || ' ' || coalesce(notes, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_items_search_idx ON work_items USING gin (search_vector);
CREATE INDEX work_items_status_idx ON work_items (status);
CREATE INDEX work_items_category_idx ON work_items (category);
CREATE INDEX work_items_due_date_idx ON work_items (due_date);

CREATE TABLE activity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO work_items (title, owner, category, status, amount, priority, due_date, notes)
SELECT title, owner, category, status, amount, priority, due_date::date, notes
FROM json_to_recordset('[{"title":"Cloud monitoring vendor","owner":"Alyssa Ford","category":"Software","status":"Security Review","amount":76000,"priority":"High","dueDate":"2026-07-29","notes":"SOC2 report uploaded."},{"title":"Regional courier vendor","owner":"Miles Chen","category":"Logistics","status":"Documents Pending","amount":34000,"priority":"Medium","dueDate":"2026-08-02","notes":"Missing W-9."}]'::json)
AS x(title text, owner text, category text, status text, amount numeric, priority text, dueDate text, notes text)
CROSS JOIN LATERAL (SELECT x.dueDate AS due_date) d;

INSERT INTO activity_entries (item_id, kind, body)
SELECT id, 'seed', 'Seed activity for ' || title
FROM work_items;
