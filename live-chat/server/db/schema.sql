-- Live Chat schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql
--
-- The interesting part is the trigger: every inserted message fires
-- pg_notify('chat', ...). The Node server LISTENs on that channel and fans the
-- payload out to connected WebSocket clients — so even a message inserted by a
-- second server instance (or psql) reaches everyone.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

CREATE TABLE rooms (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author     text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_room ON messages(room_id, created_at);

CREATE OR REPLACE FUNCTION notify_new_message() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('chat', json_build_object(
    'id', NEW.id,
    'roomId', NEW.room_id,
    'author', NEW.author,
    'body', NEW.body,
    'createdAt', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_notify
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- Seed data
INSERT INTO rooms (slug, name) VALUES
  ('general', 'General'),
  ('random', 'Random');

INSERT INTO messages (room_id, author, body)
SELECT id, 'system', 'Welcome to #general 👋' FROM rooms WHERE slug = 'general';
