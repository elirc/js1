# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

The UI edits existing ids and converts local input to explicit instants. The API validates ids, bounded text, real timestamps and forward windows. Day views send browser-local boundaries; a legacy date query explicitly means a UTC day. Database overlap enforcement is verified under concurrency and failed edits.

The key model is: Bookings link a room UUID to a title, bookedBy label and two instants. PostgreSQL stores timestamptz and enforces room-specific nonoverlap using a GiST exclusion constraint.

The worked fixture should behave as follows: Two requests for one room from 10:00 to 11:00 UTC yield one 201 and one 409. An adjacent 11:00-to-12:00 slot succeeds. Extending the first to 11:30 fails and preserves its old end. Renaming preserves its id. A query window ending at 11:00 excludes the adjacent slot.

## Extension solutions

### Exercise 1

**Prompt:** Add version-based stale-edit detection.

**Approach:** Condition the update on an expected version; the overlap constraint cannot detect lost edits.

**Review:** the version must be selected with the booking and checked in the `UPDATE ... WHERE id = $1 AND version = $2 RETURNING *`; zero rows means 409 with a distinct message from the overlap 409; the test issues two sequential `PUT`s with the same stale version and asserts 200 then 409 with the row equal to the first result; explain why the exclusion constraint cannot detect this case.

### Exercise 2

**Prompt:** Display full dates across midnight.

**Approach:** Include dates when local start/end days differ, with accessible full timestamps.

**Review:** the display must format the stored UTC instants in the viewer's zone and show the date on both ends when the local calendar days differ; assert with a fixed `Intl.DateTimeFormat` zone in a client test that `2026-03-28T23:30Z`-`2026-03-29T00:30Z` renders two dates in Europe/Berlin and one in UTC.

### Exercise 3

**Prompt:** Verify 23-hour and 25-hour day windows.

**Approach:** Construct local midnight and next midnight in a fixed timezone and assert the UTC instants sent.

**Review:** construct local midnight and the next local midnight in a fixed DST-transition zone (Europe/Berlin, 2026-03-29 and 2026-10-25), assert the UTC instants sent differ by 23 and 25 hours, and assert the day filter (`dayStart`/`dayEnd`) still returns the bookings inside that window; the 26-hour limit in `GET /api/bookings` exists for exactly this reason.

### Exercise 4

**Prompt:** Add authenticated ownership.

**Approach:** Use a verified caller identity and stored owner id at each access boundary, keeping bookedBy as separate display text.

**Review:** the owner must be a verified caller identity stored in a new `owner_id` column (not the free-text `booked_by`), checked in the `PUT`/`DELETE` statement itself (`WHERE id = $1 AND owner_id = $2`) so a cross-owner edit updates zero rows and answers 404; the test proves a foreign edit is rejected and the row unchanged.

## Ownership: reference solution

This is the solution to exercise 4. It is **not** applied to the delivered source - the shipped
API is deliberately unauthenticated - so treat it as a branch to write, not a diff to read.

### 1. An actor at the boundary (`server/src/index.ts`)

```ts
// An X-Actor header is NOT authentication. A real deployment verifies a signed
// session cookie or a bearer token here and derives the identity from that.
// This stands in for that step so the lesson can be about authorization - who
// may touch what - rather than about logins. Shipping this as-is would let any
// caller impersonate any user.
function requireActor(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const actor = req.get("X-Actor");
  if (typeof actor !== "string" || !actor.trim()) throw new ValidationError("Missing X-Actor.");
  (req as express.Request & { actor: string }).actor = actor.trim();
  next();
}
app.use("/api/bookings", requireActor);
```

Mounting it with `app.use` rather than per route means a route added next month inherits the
check instead of forgetting it. Note that throwing a `ValidationError` gives a 400 from the
existing handler; for a 401 you want a distinct error class and one more branch in the mapper at
`index.ts:113`.

### 2. The actor owns the row, and the body does not

```ts
app.post("/api/bookings", wrap(async (req, res) => {
  const input = parseBooking(req.body);
  const actor = (req as express.Request & { actor: string }).actor;
  const rows = await query<BookingRow>(
    `WITH inserted AS (
       INSERT INTO bookings (room_id, title, starts_at, ends_at, booked_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT i.id, i.room_id, r.name AS room_name, i.title, i.starts_at, i.ends_at, i.booked_by
       FROM inserted i JOIN rooms r ON r.id = i.room_id`,
    [input.roomId, input.title, input.startsAt, input.endsAt, actor]   // <- actor, not input.bookedBy
  );
  res.status(201).json(toBooking(rows[0]!));
}));
```

The whole fix is the last parameter. `input.bookedBy` is now decoration; consider dropping it
from `parseBooking` entirely so the type system stops offering it.

### 3. The check lives in the statement

```ts
app.put("/api/bookings/:id", wrap(async (req, res) => {
  const input = parseBooking(req.body);
  const actor = (req as express.Request & { actor: string }).actor;
  const rows = await query<BookingRow>(
    `WITH updated AS (
       UPDATE bookings
          SET room_id = $2, title = $3, starts_at = $4, ends_at = $5
        WHERE id = $1 AND booked_by = $6
        RETURNING *
     )
     SELECT u.id, u.room_id, r.name AS room_name, u.title, u.starts_at, u.ends_at, u.booked_by
       FROM updated u JOIN rooms r ON r.id = u.room_id`,
    [uuid(req.params.id), input.roomId, input.title, input.startsAt, input.endsAt, actor]
  );
  // Zero rows means "not yours" or "not there". We answer 404 for both: a 403
  // would confirm to a stranger that this id exists.
  if (!rows[0]) return res.status(404).json({ error: "Booking not found." });
  res.json(toBooking(rows[0]));
}));

app.delete("/api/bookings/:id", wrap(async (req, res) => {
  const actor = (req as express.Request & { actor: string }).actor;
  const { rowCount } = await pool.query(
    "DELETE FROM bookings WHERE id = $1 AND booked_by = $2",
    [uuid(req.params.id), actor]
  );
  if (rowCount === 0) return res.status(404).json({ error: "Booking not found." });
  res.status(204).send();
}));
```

`WHERE id = $1 AND booked_by = $6` is one operation: the row is located, tested and written
without any window in between. A `SELECT` followed by an `UPDATE` would leave a gap in which the
row could change owner - the same shape of gap that makes a `SELECT`-for-overlap useless and the
exclusion constraint necessary. Ownership is a narrower window than overlap; it is the same
window.

Note what the `UPDATE` no longer sets: `booked_by`. An edit must not be able to hand your booking
to someone else, and the simplest way to guarantee that is to leave the column out of the
statement.

### 4. Migration

Existing rows carry a `booked_by` that nobody authenticated. Two honest options, and you must
pick in writing:

```sql
-- (a) keep the names and accept that they are unverified claims
ALTER TABLE bookings ALTER COLUMN booked_by SET NOT NULL;   -- already true

-- (b) quarantine them: nobody owns pre-auth rows, so nobody can edit them
UPDATE bookings SET booked_by = 'legacy:' || booked_by;
```

(b) is safer and more annoying; (a) means "Avery" in the seed data can be edited by anyone who
types Avery. Assigning them to the first caller who asks is a privilege escalation with a
friendly face - reject that one explicitly.

### 5. Reference test

```ts
const as = (actor: string, path = "", init: RequestInit = {}) =>
  fetch(base + path, { ...init,
    headers: { "Content-Type": "application/json", "X-Actor": actor, ...(init.headers ?? {}) } });

// Alice creates. The body lies about the owner; the header wins.
const created = await (await as("alice", "", { method: "POST", body: JSON.stringify({
  roomId, title: "Standup", bookedBy: "bob",
  startsAt: "2026-03-08T10:00:00.000Z", endsAt: "2026-03-08T11:00:00.000Z" }) })).json();
assert.equal(created.bookedBy, "alice");

// Bob cannot edit it, and the row is untouched IN THE DATABASE.
const put = await as("bob", `/${created.id}`, { method: "PUT", body: JSON.stringify({
  roomId, title: "Hijacked", bookedBy: "bob",
  startsAt: "2026-03-08T10:00:00.000Z", endsAt: "2026-03-08T10:30:00.000Z" }) });
assert.equal(put.status, 404);
const after = await pool.query("SELECT title, ends_at FROM bookings WHERE id = $1", [created.id]);
assert.equal(after.rows[0].title, "Standup");
assert.equal(new Date(after.rows[0].ends_at).toISOString(), "2026-03-08T11:00:00.000Z");

// Bob cannot delete it either.
assert.equal((await as("bob", `/${created.id}`, { method: "DELETE" })).status, 404);
assert.equal((await pool.query("SELECT count(*) FROM bookings")).rows[0].count, "1");

// No actor at all.
assert.equal((await fetch(base)).status, 401);

// Ownership did not swallow the overlap rule: Bob booking the same slot is
// still a 409 from the exclusion constraint, not a 404 from the owner check.
const clash = await as("bob", "", { method: "POST", body: JSON.stringify({
  roomId, title: "Bob's meeting", bookedBy: "bob",
  startsAt: "2026-03-08T10:30:00.000Z", endsAt: "2026-03-08T11:30:00.000Z" }) });
assert.equal(clash.status, 409);
```

The two database reads are the assertions that matter. Every other line could be satisfied by a
handler that returns the right status and corrupts the row anyway.

### Exercise 4 — worked solution: a booking that belongs to someone

```sql
ALTER TABLE bookings ADD COLUMN owner_id text NOT NULL DEFAULT 'anonymous';
```

```typescript
// server/src/index.ts: read the caller once
app.use((req, _res, next) => { (req as any).actor = String(req.get("X-Actor") ?? "").trim(); next(); });
const requireActor = (req: express.Request) => { const a = (req as any).actor; if (!a) throw new AuthError("Sign in to change bookings."); return a; };
// POST: owner comes from the caller, never from the body
[input.roomId, input.title, input.startsAt, input.endsAt, input.bookedBy, requireActor(req)]
// PUT / DELETE: the owner check is part of the statement
`UPDATE bookings SET ... WHERE id = $1 AND owner_id = $7 RETURNING *`
`DELETE FROM bookings WHERE id = $1 AND owner_id = $2`
// error middleware: AuthError -> 401
```

Test: create as `ana` with `X-Actor: ana`; `PUT` as `ben` -> 404 and the row unchanged (read it with `admin.query`); `DELETE` as `ben` -> 404 and `count(*)` unchanged; `PUT` as `ana` -> 200; `PUT` with no header -> 401.

Review criterion: because the owner predicate is inside the `UPDATE`, there is no window between an ownership read and the write; `booked_by` stays display text and must not be used for authorization.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/booking.test.ts](../test/booking.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The UI could not edit although PUT existed. Runtime checks accepted malformed types or ambiguous timestamps, and local slot defaults mishandled midnight rollover. I changed the implementation so that: The UI edits existing ids and converts local input to explicit instants. The API validates ids, bounded text, real timestamps and forward windows. Day views send browser-local boundaries; a legacy date query explicitly means a UTC day. Database overlap enforcement is verified under concurrency and failed edits. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
