-- Support Tickets schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS ticket_events CASCADE;
DROP TABLE IF EXISTS ticket_labels CASCADE;
DROP TABLE IF EXISTS labels CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

CREATE TABLE agents (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text NOT NULL,
  email text NOT NULL UNIQUE
);

CREATE TABLE tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text NOT NULL,
  body        text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'open'   CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE labels (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'slate'
);

-- The join table that models the many-to-many between tickets and labels.
CREATE TABLE ticket_labels (
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  label_id  uuid NOT NULL REFERENCES labels(id)  ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, label_id)
);

-- An append-only audit log of everything that happens to a ticket.
CREATE TABLE ticket_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  detail     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_labels_label ON ticket_labels(label_id);
CREATE INDEX idx_events_ticket ON ticket_events(ticket_id, created_at);
CREATE INDEX idx_tickets_status ON tickets(status);

-- Seed data
INSERT INTO agents (name, email) VALUES
  ('Avery', 'avery@desk.example'),
  ('Blair', 'blair@desk.example');

INSERT INTO labels (name, color) VALUES
  ('bug', 'rose'),
  ('billing', 'amber'),
  ('question', 'indigo'),
  ('vip', 'teal');

WITH t AS (
  INSERT INTO tickets (subject, body, status, priority, assignee_id)
  SELECT 'Login button does nothing', 'Clicking sign in spins forever.', 'open', 'high', id
  FROM agents WHERE name = 'Avery'
  RETURNING id
)
INSERT INTO ticket_labels (ticket_id, label_id)
SELECT t.id, l.id FROM t, labels l WHERE l.name IN ('bug', 'vip');

INSERT INTO ticket_events (ticket_id, kind, detail)
SELECT id, 'created', 'Ticket opened (seed)' FROM tickets;
