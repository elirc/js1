-- Forum Search schema. Run: psql "$DATABASE_URL" -f server/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS thread_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE
);

CREATE TABLE threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  author_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- A generated, always-current full-text search vector. Title is weighted
  -- 'A' (most important), body 'B', so title hits rank higher.
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED
);

-- A GIN index is what makes @@ full-text matching fast.
CREATE INDEX idx_threads_search ON threads USING gin (search);

CREATE TABLE tags (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE thread_tags (
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, tag_id)
);

-- Seed data
INSERT INTO users (username) VALUES ('ada'), ('linus');
INSERT INTO tags (name) VALUES ('postgres'), ('react'), ('typescript'), ('performance');

WITH new_threads AS (
  INSERT INTO threads (title, body, author_id)
  SELECT 'Indexing strategies in Postgres',
         'When should you reach for a GIN index versus a B-tree? Full-text search needs GIN.',
         id FROM users WHERE username = 'ada'
  RETURNING id, title
)
INSERT INTO thread_tags (thread_id, tag_id)
SELECT t.id, tg.id FROM new_threads t, tags tg WHERE tg.name IN ('postgres', 'performance');

WITH new_threads AS (
  INSERT INTO threads (title, body, author_id)
  SELECT 'Typing fetch responses in React',
         'Sharing TypeScript types between the server and the React client removes a whole class of bugs.',
         id FROM users WHERE username = 'linus'
  RETURNING id
)
INSERT INTO thread_tags (thread_id, tag_id)
SELECT t.id, tg.id FROM new_threads t, tags tg WHERE tg.name IN ('react', 'typescript');

INSERT INTO threads (title, body, author_id)
SELECT 'Connection pooling explained',
       'A pool reuses Postgres connections so each request does not pay the handshake cost.',
       id FROM users WHERE username = 'ada';
