# Forum Search (TypeScript · React · Node · Postgres)

A discussion board whose lesson is **Postgres full-text search**, combined with
many-to-many tags and proper pagination.

## What it teaches

- A `tsvector` **generated column** that stays in sync automatically, with
  `setweight` so title matches outrank body matches
- A **GIN index** to make `@@` matching fast
- `websearch_to_tsquery` for Google-style input (`and`, `or`, quotes, `-term`)
- Ranking with `ts_rank` and highlighting with `ts_headline`
- `COUNT(*) OVER()` — a window function that returns the total match count in
  the *same* query as the page, avoiding a second COUNT round-trip
- Many-to-many tags with an idempotent upsert (`ON CONFLICT DO NOTHING`)
- Safe highlighting: the server emits `[[match]]` markers and the client wraps
  them in `<mark>` using text nodes (no `innerHTML`, so no XSS)

## Schema

```
users ──< threads >──< thread_tags >──< tags
            │
            └─ search  (generated tsvector, GIN indexed)
```

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb forum_search
npm install
npm run db:setup
npm run dev          # API on :4114, client on :5114
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## Stretch ideas

- Add replies (`posts`) and include them in the search vector.
- Add trigram search (`pg_trgm`) for fuzzy/typo-tolerant matching.
- Switch ranking to `ts_rank_cd` and compare the ordering.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): count/page consistency, stable ordering and bounded input, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
