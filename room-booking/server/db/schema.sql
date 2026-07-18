-- Room Booking schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- btree_gist lets a GiST index mix an equality column (room_id) with a range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

CREATE TABLE rooms (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL UNIQUE,
  capacity integer NOT NULL CHECK (capacity > 0)
);

CREATE TABLE bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  booked_by  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- A booking must end after it starts...
  CONSTRAINT ends_after_start CHECK (ends_at > starts_at),

  -- ...and no two bookings for the SAME room may overlap in time.
  -- The database itself enforces this; the app just handles the rejection.
  CONSTRAINT no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
);

CREATE INDEX idx_bookings_room ON bookings(room_id);

-- Seed data
INSERT INTO rooms (name, capacity) VALUES
  ('Aspen (4)', 4),
  ('Birch (8)', 8),
  ('Cedar (20)', 20);

INSERT INTO bookings (room_id, title, starts_at, ends_at, booked_by)
SELECT id, 'Sprint planning',
       date_trunc('hour', now()) + interval '1 hour',
       date_trunc('hour', now()) + interval '2 hours',
       'Avery'
FROM rooms WHERE name = 'Birch (8)';
