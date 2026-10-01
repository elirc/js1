# Trace lab: Half-open ranges allow back-to-back reservations

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const overlaps = (a,b) => a.start < b.end && b.start < a.end;
console.log(overlaps({start:10,end:11},{start:11,end:12})); // false
console.log(overlaps({start:10,end:11.5},{start:11,end:12})); // true
```

## Trace the real call path

### Boundary 1 — the form decides what instants to send

`client/src/App.tsx`: `handleSubmit` (line 68) converts the two `datetime-local` strings to ISO instants, but if the input string is byte-identical to what the editor was opened with (`kept.startsAtInput`, line 79-80) it re-sends the *original* instant instead of re-parsing, so a browser that normalizes sub-second values cannot shift a booking by re-saving it unchanged. The room comes from the selected room id.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `createBooking(input)` posts `{ roomId, title, bookedBy, startsAt, endsAt }` to `/api/bookings`; `updateBooking(id, input)` puts to `/api/bookings/:id`. A 409 arrives as `That room is already booked for an overlapping time.` and the form keeps its values.

### Boundary 3 — `parseBooking` validates shape and order, not availability

`server/src/validation.ts:16` `parseBooking`: object check, `uuid` for the room, bounded text for title and bookedBy, `timestamp` (line 12) requiring a real ISO timestamp *with an explicit offset* so `2026-03-29T02:30` cannot be misread on a DST day, and `endsAt > startsAt`. It deliberately does not look for conflicts: there is no `SELECT` to race on.

### Boundary 4 — one statement inserts and returns the booking

`server/src/index.ts:73` `POST /api/bookings` is a single `WITH inserted AS (INSERT ... RETURNING *) SELECT ... JOIN rooms`. The `wrap` helper forwards any rejection to the error middleware. `PUT` (line 88) is the same shape with an `UPDATE ... WHERE id = $1`.

### Boundary 5 — PostgreSQL decides who wins

`server/db/schema.sql:30` `CONSTRAINT no_overlap EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`; `btree_gist` makes the equality operand indexable. Two concurrent inserts for the same room and overlapping range serialize on the index: one commits, the other fails with SQLSTATE `23P01`. Adjacent slots (`[10:00, 11:00)` then `[11:00, 12:00)`) do not overlap because the range is half-open.

### Boundary 6 — the error middleware translates the outcome

`server/src/index.ts` error handler: `ValidationError` -> 400; `code === EXCLUSION_VIOLATION` (`23P01`) -> 409; `23503` (unknown room) -> 400; anything else 500. The test fires two overlapping `POST`s with `Promise.all`, asserts `[201, 409]` in some order, then reads the table directly.

## Follow the boundary with concrete values

This is the one project in its batch where all six boundaries are literal files, and where the
**last** one - the database - is the thing that actually keeps the data correct. Trace one
`POST /api/bookings` for Birch, 10:00-11:00 UTC, and write the value at each hand-off.

**Boundary 1 - the form (`client/src/App.tsx:118-135`, submit at `App.tsx:70-95`).**
Two `<input type="datetime-local" step="0.001">` fields feed `form.startsAt` / `form.endsAt`,
which are **local wall-clock strings** with no timezone at all: `2026-03-08T10:00:00.000`. Write
that down and keep it separate in your head from everything below, because the entire first half
of this trace is about attaching a timezone to it. Note also what the component keeps that the
form does not show: `original.current` holds the instants the editor was opened with, so an
untouched field is never re-parsed (`02-CONCEPTS.md` explains why).

**Boundary 2 - the client serializer (`App.tsx:75-82` and `client/src/api.ts:21-27`).**
`new Date(form.startsAt).toISOString()`. The `Date` constructor reads a string with no offset as
**local time**, and `toISOString()` renders it in **UTC** - so this single expression is where the
browser's timezone is applied and then discarded. For a user in New York on March 8th,
`2026-03-08T10:00:00.000` becomes `2026-03-08T15:00:00.000Z`. Then `fetch` with
`Content-Type: application/json`. Do this conversion by hand for one timezone west and one east
of UTC before you run anything; it is the step people get wrong.

Separately, `listBookings` (`api.ts:9-19`) builds the day window with
`new Date(\`${filters.date}T00:00\`)` - local midnight - and `setDate(+1)` for the other end.
That is deliberate: `setDate` crosses a DST boundary correctly because it works in local time, so
the window is a real local day rather than a fixed 24 hours.

**Boundary 3 - the HTTP route (`server/src/index.ts:73-87`).**
`app.post("/api/bookings", wrap(async (req, res) => ...))`. Note what `wrap` (`index.ts:10`) buys
you: an `async` handler that rejects would otherwise be an unhandled rejection and a hung client;
`wrap` routes it to the error handler instead. All five routes use it - the POST and PUT were
hand-wrapped in their own `try/catch` until that inconsistency was cleaned up, and the behaviour
is identical, which is the point of having one helper rather than five copies.

**Boundary 4 - the validator (`parseBooking`, `server/src/validation.ts:19-29`).**
Four kinds of rejection, all before any SQL. `uuid()` for the room id; `text()` for non-empty
strings bounded at 255; `timestamp()` (`validation.ts:16`) which is the interesting one - it
**requires** an explicit `Z` or `±HH:MM` offset and rejects anything else. That is not pedantry:
a bare `2026-03-08T10:00` handed to Postgres as `timestamptz` would be interpreted in the
*server's* timezone, so the same request would mean different instants on a laptop and in
production (see `00-PREREQS.md` section 1). It then normalises with `new Date(value).toISOString()`
so everything downstream is UTC. Finally `endsAt <= startsAt` is rejected here **as well as** by
the database's `ends_after_start` check - a fast, friendly 400 in front of a slow, correct 23514.

**Boundary 5 - the database as the arbiter (`server/db/schema.sql`, `EXCLUDE USING gist`).**
The decisive boundary, and the reason this project is worth a day. The application does **not**
check for a conflicting booking. There is no `SELECT ... WHERE overlaps` anywhere - deliberately,
because two requests can both observe no overlap before either inserts, and no amount of
application code closes that window. The single `INSERT ... RETURNING` either takes the index
entry or raises **23P01**. Write the interleaving out: request A validates, request B validates,
A inserts, B inserts, B is rejected by the index - one 201 and one 409, with no lock held by your
code and no retry loop. That is exactly what the delivered test races.

**Boundary 6 - error code to HTTP status, and back to the user
(`index.ts:113-129`, then `App.tsx:88-93`).**
The handler maps SQLSTATEs to statuses: `23P01` → **409** "already booked", `23514` → **400** "end
after start", `23503` → **400** "choose an existing room", anything else → 500 with the real error
logged and not shown. Note the shape: the database states the rule, the application only
translates. On the client a 409 arrives as an ordinary `Error`, sets `conflict` and shows the
message, and - critically - the form is **not** reset, so the user can change the time and retry.

### Two further traces worth running

Update the winning booking to overlap its neighbour and confirm the failed `UPDATE` leaves the old
`ends_at` in place - read it back with SQL, not from the error response, which is what the
delivered test does. Then separate that invariant from **stale-edit** protection: nothing here
stops a second user's update from overwriting a first user's, because both updates are
individually legal. That needs a version column, and it is exercise 1.

## Connect the model to real code

Open [server/src/validation.ts](../server/src/validation.ts) beside [test/booking.test.ts](../test/booking.test.ts). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

Two requests for one room from 10:00 to 11:00 UTC yield one 201 and one 409. An adjacent 11:00-to-12:00 slot succeeds. Extending the first to 11:30 fails and preserves its old end. Renaming preserves its id. A query window ending at 11:00 excludes the adjacent slot.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
