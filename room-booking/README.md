# Room Booking (TypeScript · React · Node · Postgres)

A meeting-room reservation app whose lesson is letting the **database enforce a
hard business rule**: the same room can never be double-booked, even under
concurrent requests.

## What it teaches

- Postgres range types (`tstzrange`) and the overlap operator `&&`
- An `EXCLUDE USING gist (...)` constraint backed by the `btree_gist` extension
- A `CHECK` constraint (`ends_at > starts_at`)
- Mapping Postgres error codes to HTTP status:
  - `23P01` (exclusion violation) → `409 Conflict`
  - `23514` (check violation) → `400 Bad Request`
- Using `WITH ... RETURNING` to insert and join in a single round-trip
- Filtering a day's schedule with range overlap, not `BETWEEN` gymnastics

## Why the constraint matters

App-level "is this slot free?" checks have a race condition: two requests can
both read "free" and both insert. The exclusion constraint makes the database
the single arbiter, so one insert succeeds and the other is rejected atomically.

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb room_booking
npm install
npm run db:setup      # also enables the btree_gist extension
npm run dev           # API on :4112, client on :5112
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.
> Times are stored as `timestamptz`; the demo treats `datetime-local` input as
> the server's local time, which is fine for learning.

## Stretch ideas

- Add a `GET /api/rooms/:id/availability?date=` endpoint that returns free gaps.
- Allow editing a booking in the UI (the `PUT` route already exists).
- Add a buffer (e.g. 10-minute gap) by padding the range in the constraint.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): half-open intervals, database constraints and timezones, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
