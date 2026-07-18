# Forum Search - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4114**. Tables `users`,
> `threads` (with a generated `tsvector search` column, GIN-indexed), `tags`,
> `thread_tags` (M:N). `server/src/index.ts` searches with
> `websearch_to_tsquery`, ranks with `ts_rank`, snippets with `ts_headline`
> (`[[ ]]` markers), and paginates with `COUNT(*) OVER()`. The client wraps
> `[[...]]` in `<mark>`. `shared/types.ts` shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Replies that are searchable
**As a** user, **I want** replies, **so that** discussions continue and are findable.

### Acceptance criteria
- [ ] A `posts` table stores replies `{ id, thread_id, author_id, body, created_at }`.
- [ ] Reply text contributes to the thread's search (matches surface the thread).
- [ ] `GET/POST /api/threads/:id/posts` work; replies cascade on thread delete.

### Implementation plan
1. **`server/db/schema.sql`** - add the `posts` table (`ON DELETE CASCADE`). To include replies in search, either (a) add a trigger that re-derives the thread's search vector from title+body+concatenated replies, or (b) keep the generated column and add a second GIN index on `posts` and search `threads.search @@ q OR EXISTS (post matches)`. Option (b) is simpler - document it. Re-run setup.
2. **`server/src/index.ts`** - extend the search `WHERE` with the `EXISTS (SELECT 1 FROM posts p WHERE p.thread_id=t.id AND to_tsvector('english',p.body) @@ websearch_to_tsquery('english',$1))` branch. Add nested `GET/POST /api/threads/:id/posts`.
3. **`shared/types.ts`** + **`client/src/App.tsx`** - add a `Post` type and a thread detail view with replies + a reply box.

### How to test
Post a reply containing a unique word, search for that word, confirm the parent thread appears in results.

---

## Story 2: Sort control (relevance vs newest)
**As a** user, **I want** to choose ordering, **so that** I can browse or search.

### Acceptance criteria
- [ ] A sort toggle offers Relevance (default when searching) and Newest.
- [ ] With an empty query, Relevance falls back to newest (rank is 0 for all).

### Implementation plan
1. **`server/src/index.ts`** - read `sort` in `GET /api/threads`; build the `ORDER BY` conditionally: `newest` -> `t.created_at DESC`; `relevance` -> `ts_rank(...) DESC, t.created_at DESC` (the current behavior).
2. **`client/src/App.tsx`** - add a sort `<select>` into `queryState`; the existing effect refetches.

### How to test
Search a term and switch between Relevance and Newest, confirm the order changes; clear the query and confirm Newest-equivalent ordering.

---

## Story 3: Trigram fuzzy search for typos
**As a** user, **I want** typo-tolerant search, **so that** small misspellings still match.

### Acceptance criteria
- [ ] Searches like `postgers` still surface `postgres` threads.
- [ ] Fuzzy matching is used as a fallback when full-text returns no rows.

### Implementation plan
1. **`server/db/schema.sql`** - `CREATE EXTENSION IF NOT EXISTS pg_trgm;` and add a trigram index: `CREATE INDEX idx_threads_title_trgm ON threads USING gin (title gin_trgm_ops);`. Re-run setup.
2. **`server/src/index.ts`** - after the normal search, if `rows.length === 0` and `q` is non-empty, run a fallback query ordered by `similarity(t.title, $1) DESC` with a threshold (`WHERE similarity(t.title,$1) > 0.2`). Return those (snippet can be the body head).
3. **`client/src/App.tsx`** - optionally show a "Showing fuzzy matches for ..." note when the fallback fired.

### How to test
Search `postgers`, confirm the Postgres thread still appears via the fuzzy fallback; an exact term still uses the fast full-text path.

---

## Story 4: Tag management with counts (admin)
**As an** admin, **I want** to manage tags, **so that** the tag list stays tidy.

### Acceptance criteria
- [ ] `GET /api/tags` already returns counts; add rename and delete.
- [ ] Renaming updates the tag everywhere; deleting removes its links.

### Implementation plan
1. **`server/src/index.ts`** - add `PUT /api/tags/:name` (update `name`, unique-violation `23505` -> 409) and `DELETE /api/tags/:name` (the `thread_tags` FK cascades).
2. **`client/src/App.tsx`** - in the tag cloud area, add small rename/delete controls (admin mode); reload tags after changes.

### How to test
Rename `react` to `reactjs`, confirm tagged threads now show `reactjs` and the count carries over; delete a tag and confirm it leaves the cloud and threads.

---

## Story 5: Author profile page
**As a** user, **I want** to see a user's threads, **so that** I can follow contributors.

### Acceptance criteria
- [ ] `GET /api/users/:id/threads` returns that user's threads (paginated).
- [ ] Clicking an author name opens their profile list.

### Implementation plan
1. **`server/src/index.ts`** - add the route reusing the thread `SELECT` with `WHERE t.author_id = $1` and the same pagination envelope/window-count pattern.
2. **`client/src/api.ts`** - add `getUserThreads(id, page)`.
3. **`client/src/App.tsx`** - make author names clickable; render a profile panel that lists their threads with the existing pager.

### How to test
Click an author, confirm only their threads list and paginate correctly.

