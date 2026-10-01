# Prerequisites: ranges, exclusion constraints, and days that are not 24 hours

[Course index](README.md)

This is the hardest project in its batch, and the rest of the course assumes four things you may
never have met. Work through this page first with a `psql` prompt open. Budget an hour; you can
paste every block here into a scratch database and watch it answer.

You need a PostgreSQL you can connect to, and a database you do not mind writing to. Everything
below runs in a throwaway schema:

```sql
CREATE SCHEMA prereq;
SET search_path TO prereq, public;
```

Drop it with `DROP SCHEMA prereq CASCADE;` when you are done.

---

## 1. `timestamptz` is an instant, not a wall clock

The single most common misunderstanding about Postgres time types. `timestamptz` does **not**
store a timezone. It stores an absolute instant, normalised to UTC, and renders it in whatever
timezone your session is set to.

```sql
SET timezone TO 'UTC';
SELECT '2026-03-08 10:00:00+00'::timestamptz;   -- 2026-03-08 10:00:00+00
SET timezone TO 'America/New_York';
SELECT '2026-03-08 10:00:00+00'::timestamptz;   -- 2026-03-08 05:00:00-05  (same instant)
```

The value did not change; the rendering did. Two consequences that matter in this project:

- A timestamp sent from a browser **must** carry an explicit offset, or Postgres will interpret
  it in the *server's* timezone and you will store a different instant than the user meant.
  That is why `timestamp()` in `server/src/validation.ts:16` rejects any string without a `Z` or
  a `±HH:MM`, and why the client converts with `new Date(...).toISOString()` before sending.
- `timestamp` (without `tz`) is a different type and is almost never what you want for an event
  that happens at a real moment. Use it for "the shop opens at 09:00" — a rule, not an instant.

```sql
SELECT '2026-03-08 10:00:00'::timestamp;    -- no offset: this is just a label
SELECT '2026-03-08 10:00:00'::timestamptz;  -- interpreted in YOUR session timezone. Different!
```

Run the second line under two different `SET timezone` values and watch it produce two different
instants from identical text. That is the bug the validator exists to prevent.

---

## 2. `tstzrange` and the half-open rule

A range type packages two endpoints and, crucially, whether each end is included.

```sql
SELECT tstzrange('2026-03-08 10:00+00', '2026-03-08 11:00+00', '[)');
```

The `'[)'` is the **bounds** argument: `[` means the lower end is included, `)` means the upper
end is excluded. `[)` — "half-open" — is the default and it is the right default for time.
Here is why, in one query:

```sql
SELECT
  tstzrange('2026-03-08 10:00+00','2026-03-08 11:00+00','[)')
    && tstzrange('2026-03-08 11:00+00','2026-03-08 12:00+00','[)') AS half_open,
  tstzrange('2026-03-08 10:00+00','2026-03-08 11:00+00','[]')
    && tstzrange('2026-03-08 11:00+00','2026-03-08 12:00+00','[]') AS closed;
-- half_open = false, closed = true
```

`&&` is the overlap operator. With `[)`, a meeting that ends at 11:00 and one that starts at
11:00 do **not** overlap — which is what everybody means by "back-to-back meetings". With `[]`
they do, and your booking system refuses adjacent slots for no reason a user would accept.
The delivered test asserts exactly this: two requests for 10:00–11:00 give one 201 and one 409,
while 11:00–12:00 succeeds.

Useful operators to try now, so they are familiar when you meet them in `index.ts`:

```sql
SELECT tstzrange('2026-03-08 10:00+00','2026-03-08 12:00+00') @> '2026-03-08 11:00+00'::timestamptz; -- contains
SELECT tstzrange('2026-03-08 10:00+00','2026-03-08 12:00+00')
    && tstzrange('2026-03-08 11:00+00','2026-03-08 13:00+00');                                       -- overlaps
SELECT lower(tstzrange('2026-03-08 10:00+00','2026-03-08 12:00+00'));                                -- 10:00
```

Note that the table does **not** store a range column. It stores `starts_at` and `ends_at`, and
builds a range on the fly wherever it needs one (`server/db/schema.sql`, and the day filter at
`server/src/index.ts:69`). That is a deliberate trade: two plain columns are easier to select,
sort and return as JSON, and the range is only needed for the overlap question.

---

## 3. `EXCLUDE USING gist` — a constraint that is not `UNIQUE`

You already know `UNIQUE`: no two rows may have the **same** value. An exclusion constraint is
the generalisation: no two rows may have values that are **related** by an operator you choose.
`UNIQUE` is the special case where the operator is `=`.

Here is this project's constraint, reduced to something you can run:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE demo_bookings (
  id      serial PRIMARY KEY,
  room_id integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  CONSTRAINT no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
);

INSERT INTO demo_bookings (room_id, starts_at, ends_at)
VALUES (1, '2026-03-08 10:00+00', '2026-03-08 11:00+00');   -- ok

INSERT INTO demo_bookings (room_id, starts_at, ends_at)
VALUES (1, '2026-03-08 10:30+00', '2026-03-08 11:30+00');   -- ERROR: conflicting key value
                                                            -- violates exclusion constraint

INSERT INTO demo_bookings (room_id, starts_at, ends_at)
VALUES (2, '2026-03-08 10:30+00', '2026-03-08 11:30+00');   -- ok: different room

INSERT INTO demo_bookings (room_id, starts_at, ends_at)
VALUES (1, '2026-03-08 11:00+00', '2026-03-08 12:00+00');   -- ok: adjacent, thanks to [)
```

Read the constraint out loud: *"reject a row if there is an existing row where `room_id` is `=`
**and** the two time ranges `&&` overlap."* Both conditions must hold for the rejection.

**Capture the error code**, because the application depends on it:

```sql
\set VERBOSITY verbose
INSERT INTO demo_bookings (room_id, starts_at, ends_at)
VALUES (1, '2026-03-08 10:30+00', '2026-03-08 11:30+00');
```

You will see `SQLSTATE 23P01`. That is `exclusion_violation`, and it is the constant
`EXCLUSION_VIOLATION` at `server/src/index.ts:17`, mapped to HTTP **409 Conflict** by the error
handler. `23514` is `check_violation` (the `ends_after_start` check), and `23503` is
`foreign_key_violation` (a room id that does not exist). Learning to look up a five-character
SQLSTATE rather than pattern-matching an error message is a career skill; the full table is in
the PostgreSQL docs under "Error Codes".

### Why the constraint and not application code?

You could `SELECT` for a conflict and then `INSERT` if there is none. Run this thought experiment
before reading on: two requests arrive at the same millisecond, both `SELECT`, both see no
conflict, both `INSERT`. Nothing in the application can prevent that, because the gap between the
check and the write is where the other transaction lives. You would need `SERIALIZABLE` isolation
(and retry logic for the serialization failures it raises), or an explicit lock on the room.

The constraint has no gap: the index entry is taken as part of the insert. The application's job
shrinks to *handling the rejection politely* — which is what the whole course is about, and why
`VERIFICATION.md` can claim a genuine concurrency test rather than a hopeful one.

### Why `btree_gist`?

A GiST index natively understands range operators like `&&`, but it does **not** natively
understand plain `=` on a `uuid` or an `integer` — that is B-tree's job. The `btree_gist`
extension teaches GiST the B-tree operators, so a single GiST index can mix
`room_id WITH =` and a range `WITH &&`. Prove it to yourself:

```sql
DROP EXTENSION btree_gist CASCADE;   -- drops the demo constraint with it
CREATE TABLE demo2 (room_id integer, starts_at timestamptz, ends_at timestamptz,
  EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at) WITH &&));
-- ERROR: data type integer has no default operator class for access method "gist"
CREATE EXTENSION btree_gist;   -- now the same statement works
```

That error message is one you would otherwise lose an afternoon to.

---

## 4. A day is not 24 hours

`server/src/index.ts:60-61` bounds a day window at **26 hours**, and `client/src/api.ts` builds
that window from the browser's local midnight. Both numbers look arbitrary until you meet a
daylight-saving transition.

```sql
SET timezone TO 'America/New_York';
SELECT '2026-11-01 00:00'::timestamptz AS start,
       '2026-11-02 00:00'::timestamptz AS finish,
       '2026-11-02 00:00'::timestamptz - '2026-11-01 00:00'::timestamptz AS length;
-- length = 25:00:00
SELECT '2026-03-08 00:00'::timestamptz AS start,
       '2026-03-09 00:00'::timestamptz - '2026-03-08 00:00'::timestamptz AS length;
-- length = 23:00:00
```

On 2026-11-01 the clocks go back and the local day is **25 hours**; on 2026-03-08 they go forward
and it is **23**. So:

- "Today's bookings" cannot be `start` plus 24 hours. It is local midnight to the *next* local
  midnight, which the client computes with `new Date(\`${date}T00:00\`)` — a constructor that
  works in local time and therefore gets DST right for free.
- The 26-hour cap is a sanity bound that still admits a legitimate 25-hour day while rejecting a
  client asking for a year of data in one request.
- A booking that "lasts one hour" may be a different number of wall-clock hours from a booking
  an hour later on a transition day. Instants are unambiguous; local labels are not. This is the
  same lesson as section 1, arriving from the other direction.

Also note the third path in that handler: a legacy `?date=YYYY-MM-DD` query is explicitly mapped
to a **UTC** day (`${date}T00:00:00.000Z`). Two clients asking for "March 8th" can therefore get
different answers depending on which parameter they use — which is a documented decision, not an
accident, and exactly the kind of thing to write down when you design an API.

---

## Checklist before you continue

You should be able to answer these without looking:

1. What does `timestamptz` actually store, and what does `SET timezone` change?
2. Why does `'[)'` make back-to-back meetings legal, and what breaks if you use `'[]'`?
3. Write, from memory, an exclusion constraint that stops two bookings overlapping in one room.
4. Which SQLSTATE does that constraint raise, and which HTTP status does this app map it to?
5. Why can `SELECT`-then-`INSERT` not provide the same guarantee?
6. What is `btree_gist` for, and what error do you get without it?
7. How long is 2026-11-01 in America/New_York, and why does the day filter care?

If any answer is shaky, re-run that section's SQL before starting
[01-CODEBASE-MAP.md](01-CODEBASE-MAP.md). The rest of the course moves quickly and assumes all
seven.

```sql
DROP SCHEMA prereq CASCADE;
```
