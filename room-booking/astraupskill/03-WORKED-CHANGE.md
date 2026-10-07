# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The UI could not edit although PUT existed. Runtime checks accepted malformed types or ambiguous timestamps, and local slot defaults mishandled midnight rollover.

**After:** The UI edits existing ids and converts local input to explicit instants. The API validates ids, bounded text, real timestamps and forward windows. Day views send browser-local boundaries; a legacy date query explicitly means a UTC day. Database overlap enforcement is verified under concurrency and failed edits.

## Predict this example

Two requests for one room from 10:00 to 11:00 UTC yield one 201 and one 409. An adjacent 11:00-to-12:00 slot succeeds. Extending the first to 11:30 fails and preserves its old end. Renaming preserves its id. A query window ending at 11:00 excludes the adjacent slot.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/validation.ts](../server/src/validation.ts) near line 16.
It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read
surrounding code for callers and setup.

**What changed here.** The whole file is new. In
`git show 606e0e6:room-booking/server/src/index.ts` there was
no `validation.ts` at all: `parseBooking` lived at the bottom of the route file (lines 135-152)
and looked like this, in full:

```ts
function parseBooking(body: unknown): NewBooking {
  const data = body as Partial<NewBooking>;               // a cast, not a check
  if (!data.roomId) throw new ValidationError("Choose a room.");
  if (!data.title?.trim()) throw new ValidationError("Give the booking a title.");
  if (!data.bookedBy?.trim()) throw new ValidationError("Who is booking?");
  if (!data.startsAt || !data.endsAt) throw new ValidationError("Pick a start and end time.");
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    throw new ValidationError("End time must be after the start time.");
  }
  return { roomId: data.roomId, title: data.title.trim(), bookedBy: data.bookedBy.trim(),
           startsAt: data.startsAt, endsAt: data.endsAt };  // passed straight through
}
```

Every check there is a **truthiness** check. `body as Partial<NewBooking>` is a cast, which does
nothing at run time - TypeScript's opinion about a value it never saw. So `roomId: 42` passes
(truthy), `roomId: "'; DROP TABLE"` passes (truthy, and then fails as a Postgres uuid cast with a
500), and `startsAt: "2026-03-08T10:00"` passes and is handed to the database **unchanged**,
timezone-less. List what each of those five lines actually rejects and you will find the answer
is: `undefined`, `null`, `""` and `0`. That is the difference between checking a field is
*present* and checking it is *valid*.

The delivered version splits this into typed parsers (`uuid`, `realDate`, `timestamp`, `text`)
in their own module, so they can be unit-tested without standing up Express - which is why
`test/booking.test.ts` can import `parseBooking` directly at line 6. `timestamp()` is the one in
the excerpt below. Read the regex as a
list of decisions rather than as one wall: the date and time shape, the hour bounded at `2[0-3]`
and the minute at `[0-5]\d` (so `25:00` is rejected before `Date` can roll it into the next day),
optional seconds, optional milliseconds capped at three digits - and then, at the end, the part
that matters most:

    (?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)

An explicit timezone is **required**. Not defaulted, not assumed: required. `2026-03-08T10:00`
is rejected with a 400 rather than being handed to Postgres, which would have interpreted it in
the *server's* timezone - so the identical request would mean 10:00 New York on a developer's
laptop and 10:00 UTC in production, and the bug would only ever appear for users in a timezone
nobody on the team lives in. `00-PREREQS.md` section 1 has the `SET timezone` demonstration.

The two lines after the regex are easy to skim past and both earn their place.
`realDate(value.slice(0,10))` re-uses the calendar check so `2026-02-30T10:00:00Z` - which
`Date.parse` happily rolls to March 1 - is rejected rather than silently moved. And the return is
`new Date(value).toISOString()`, which **normalises**: every instant below this line is UTC with
milliseconds, whatever offset the client used, so nothing downstream has to think about it again.
Validate at the boundary, normalise at the boundary, and the rest of the program gets one shape.

```typescript
export function parseBooking(body: unknown): NewBooking {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Supply a booking object.");
  const data = body as Record<string, unknown>;
  const text = (key: string) => {
    const value = data[key];
    if (typeof value !== "string" || !value.trim() || value.length > 255) throw new ValidationError(`${key} must be nonempty text up to 255 characters.`);
    return value.trim();
  };
  const startsAt = timestamp(data.startsAt), endsAt = timestamp(data.endsAt);
  if (endsAt <= startsAt) throw new ValidationError("End time must be after the start time.");
  return { roomId: uuid(data.roomId), title: text("title"), bookedBy: text("bookedBy"), startsAt, endsAt };
}
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Half-open intervals include their start and exclude their end, so adjacent meetings can share a boundary. A check-then-insert in application code has a race; the database constraint is the final arbiter. A failed UPDATE preserves the previous row. datetime-local has no timezone, so the browser converts it to an ISO instant before submission. A local day is represented by two independently computed midnights, which can be 23 or 25 hours apart. The explicit legacy UTC-day policy avoids depending on a database session timezone. bookedBy is a human label, not authentication: this demo does not enforce ownership. Runtime validation gives helpful errors, while the constraint protects integrity even for competing writes. An overlap test and a failed-update test prove different postconditions.

## Three variations to work through

**Normal variation — adjacent slots.** Book Birch `10:00-11:00Z`, then `11:00-12:00Z`. Predict 201 and 201: `[)` ranges that touch do not overlap. Then `10:30-11:30Z`: predict 409 from the exclusion constraint, and `SELECT count(*) FROM bookings` unchanged.

**Invalid variation — an offset-less timestamp.** Post `startsAt: "2026-03-29T02:30:00"`. Predict 400 `Times must be real ISO timestamps with an explicit timezone offset.` from `timestamp()` and no query. Then post `2026-02-30T10:00:00Z`: predict which check fires (`realDate`).

**Boundary variation — the race.** Reproduce the first test: two identical bookings in a `Promise.all`. Predict `[201, 409]` and one row. Then on a throwaway branch drop the `no_overlap` constraint in your dev database and repeat: predict `[201, 201]` and two overlapping rows; restore it with the statement from `schema.sql:30`.

## Executable examples

These are the actual regression tests in [test/booking.test.ts](../test/booking.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { parseBooking } from "../server/src/validation.js";
const input = process.env.ASTRA_TEST_DATABASE_URL;
if (!input || !/^astra_test_[a-z0-9_]+$/.test(new URL(input).pathname.slice(1)))
  throw new Error("Use a dedicated ASTRA_TEST_DATABASE_URL named astra_test_*");
const schema = `astra_booking_${randomBytes(6).toString("hex")}`;
const url = new URL(input);
url.searchParams.set("options", `-c search_path=${schema},public`);
process.env.DATABASE_URL = url.href;
test("database enforces concurrent overlap, adjacent slots and failed-edit preservation through HTTP", async (t) => {
  const admin = new pg.Client({ connectionString: input });
  await admin.connect();
  await admin.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
  await admin.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.query(`SET search_path TO "${schema}", public`);
  let sql = await readFile(
    new URL("../server/db/schema.sql", import.meta.url),
    "utf8",
  );
  // The schema is unique and empty. Never run the scaffold's DROP TABLE statements against a fallback namespace.
  sql = sql.replace(/^DROP TABLE.*$/gm, "");
  await admin.query(sql);
  const { app } = await import("../server/src/index.js");
  const { pool } = await import("../server/src/db.js");
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method: string, path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  }
  const rooms = await request("GET", "/api/rooms");
  const roomId = rooms.body[0].id;
  const booking = {
    roomId,
    title: "Session",
    bookedBy: "Junior",
    startsAt: "2030-03-10T10:00:00Z",
    endsAt: "2030-03-10T11:00:00Z",
  };
  const race = await Promise.all([
    request("POST", "/api/bookings", booking),
    request("POST", "/api/bookings", booking),
  ]);
  assert.deepEqual(race.map((x) => x.status).sort(), [201, 409]);
  const original = race.find((x) => x.status === 201)!.body;
  const adjacent = await request("POST", "/api/bookings", {
    ...booking,
    startsAt: booking.endsAt,
    endsAt: "2030-03-10T12:00:00Z",
  });
  assert.equal(adjacent.status, 201);
  const failed = await request("PUT", `/api/bookings/${original.id}`, {
    ...booking,
    endsAt: "2030-03-10T11:30:00Z",
  });
  assert.equal(failed.status, 409);
  const persisted = await admin.query(
    "SELECT ends_at FROM bookings WHERE id=$1",
    [original.id],
  );
  assert.equal(
    persisted.rows[0].ends_at.toISOString(),
    booking.endsAt.replace("Z", ".000Z"),
  );
  const changed = await request("PUT", `/api/bookings/${original.id}`, {
    ...booking,
    title: "Renamed",
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.id, original.id);
  for (const change of [
    { title: 42 },
    { startsAt: "2030-02-30T10:00:00Z" },
    { startsAt: "2030-03-10T10:00" },
    { endsAt: booking.startsAt },
  ])
    assert.equal(
      (await request("POST", "/api/bookings", { ...booking, ...change }))
        .status,
      400,
    );
  assert.equal(
    (await request("GET", "/api/bookings?date=2030-02-30")).status,
    400,
  );
  assert.equal(
    (await request("DELETE", "/api/bookings/not-a-uuid")).status,
    400,
  );
  const window = new URLSearchParams({
    roomId,
    dayStart: "2030-03-10T10:30:00Z",
    dayEnd: "2030-03-10T11:00:00Z",
  });
  const filtered = await request("GET", "/api/bookings?" + window);
  assert.deepEqual(
    filtered.body.map((x: any) => x.id),
    [original.id],
  );
});
test("equivalent offset timestamps normalize and malformed bodies are domain errors", () => {
  const body = {
    roomId: "00000000-0000-0000-0000-000000000001",
    title: "T",
    bookedBy: "J",
    startsAt: "2030-03-10T03:00:00-07:00",
    endsAt: "2030-03-10T04:00:00-07:00",
  };
  assert.equal(parseBooking(body).startsAt, "2030-03-10T10:00:00.000Z");
  for (const value of [
    null,
    [],
    { ...body, roomId: 42 },
    { ...body, title: {} },
  ])
    assert.throws(() => parseBooking(value));
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
