# Room Booking - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4112**. Tables `rooms` and
> `bookings`; an `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at,
> ends_at) WITH &&)` constraint (with `btree_gist`) blocks overlaps, and a
> `CHECK (ends_at > starts_at)`. `server/src/index.ts` maps PG errors `23P01`->409
> and `23514`->400. `shared/types.ts` shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Edit a booking in the UI
**As a** user, **I want** to reschedule, **so that** I can fix a booking (the `PUT` route already exists).

### Acceptance criteria
- [ ] Clicking "Edit" on a booking loads it into the form.
- [ ] Saving calls `PUT /api/bookings/:id`; overlap conflicts still return 409 and show a message.
- [ ] Editing a booking to its own existing time does not conflict with itself.

### Implementation plan
1. **`client/src/api.ts`** - add `updateBooking(id, input)` (PUT) following the existing helpers.
2. **`client/src/App.tsx`** - add `editingId` state and an "Edit" button per schedule row that loads the booking into the form; `handleSubmit` branches to update vs create.
3. The exclusion constraint already ignores the row being updated (an `UPDATE` doesn't conflict with its own current range), so no server change is needed.

### How to test
Edit a booking's time to a free slot (saves), then to a slot occupied by a *different* booking (409 + message), then back to its own original time (saves fine).

---

## Story 2: Availability endpoint (free gaps)
**As a** user, **I want** to see open time slots, **so that** I know when I can book.

### Acceptance criteria
- [ ] `GET /api/rooms/:id/availability?date=YYYY-MM-DD` returns the free gaps within business hours (e.g. 08:00-18:00).
- [ ] Gaps are computed from existing bookings for that day.

### Implementation plan
1. **`server/src/index.ts`** - add the route: fetch that day's bookings ordered by `starts_at` (reuse the day-overlap query). In TS, walk from the day's open time, emitting `{ start, end }` gaps between consecutive bookings and after the last one until close.
2. **`shared/types.ts`** - add a `Gap` interface (`{ start: string; end: string }`).
3. **`client/src/App.tsx`** - show the gaps for the selected room/day as quick "Book this slot" chips that prefill the form.

### How to test
With one midday booking, request availability and confirm two gaps (morning + afternoon); a fully free day returns one gap spanning business hours.

---

## Story 3: Recurring weekly bookings
**As a** user, **I want** to book a weekly recurring slot, **so that** I don't re-enter it.

### Acceptance criteria
- [ ] A "Repeat weekly for N weeks" option creates N bookings one week apart.
- [ ] Each week is attempted independently; conflicting weeks are skipped and reported, non-conflicting ones are created.

### Implementation plan
1. **`server/src/index.ts`** - add `POST /api/bookings/recurring` accepting the base booking + `weeks`. Loop in TS, adding 7 days each iteration; insert each in its own `try/catch`, collecting `{ created: [...], skipped: [weekIndex...] }`. (Don't wrap all weeks in one transaction, or one conflict would roll back the lot.)
2. **`client/src/api.ts`** + **`App.tsx`** - add a "weeks" input and call the route; show "Created X, skipped Y (conflicts)".

### How to test
Pre-book week 3's slot, then create a 4-week recurrence; confirm weeks 1,2,4 are created and week 3 is reported as skipped.

---

## Story 4: Buffer time between bookings
**As an** admin, **I want** a cleaning buffer, **so that** back-to-back bookings have a gap.

### Acceptance criteria
- [ ] A configurable buffer (e.g. 10 min) means a booking ending at 10:00 blocks another starting before 10:10 in the same room.
- [ ] The buffer is enforced by the database, not just the app.

### Implementation plan
1. **`server/db/schema.sql`** - change the exclusion constraint to pad the range: `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at - interval '10 minutes', ends_at + interval '10 minutes') WITH &&)`. (Drop/recreate the constraint; re-run setup.)
2. **`server/src/index.ts`** - the existing `23P01` handler already returns 409; optionally tweak the message to mention the buffer.
3. **`client/src/App.tsx`** - note the buffer near the form so users understand the rejection.

### How to test
Book 09:00-10:00, then try 10:05-10:30 in the same room -> 409 (within buffer); 10:15-10:45 succeeds.

---

## Story 5: Room management with capacity check
**As an** admin, **I want** to manage rooms, **so that** the catalog stays current.

### Acceptance criteria
- [ ] `POST/PUT/DELETE /api/rooms` manage rooms; deleting a room cascades its bookings.
- [ ] An optional `attendees` count on a booking cannot exceed the room's `capacity` (400 otherwise).

### Implementation plan
1. **`server/src/index.ts`** - add room CRUD routes (the `rooms` table and `ON DELETE CASCADE` from bookings already exist).
2. **`server/db/schema.sql`** - add `attendees integer NOT NULL DEFAULT 1 CHECK (attendees > 0)` to `bookings`. Re-run setup.
3. **`server/src/index.ts`** - in `parseBooking`/insert, when `attendees` is provided, look up the room's `capacity` and reject if `attendees > capacity`.
4. **`shared/types.ts`** + **`client/src/App.tsx`** - add an attendees field and room admin UI.

### How to test
Create a capacity-4 room, book with attendees=6 -> 400; attendees=4 -> ok; delete the room and confirm its bookings are gone.

