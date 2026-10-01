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
