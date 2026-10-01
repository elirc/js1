import "dotenv/config";
import { pathToFileURL } from "node:url";
import { parseBooking, uuid, realDate, timestamp, ValidationError } from "./validation.js";
import express from "express";
import cors from "cors";
import { pool, query } from "./db.js";
import type { Booking, NewBooking, Room } from "../../shared/types.js";

export const app = express();
const wrap = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
const port = Number(process.env.PORT ?? 4112);

app.use(cors());
app.use(express.json());

// Postgres error codes we care about.
const EXCLUSION_VIOLATION = "23P01"; // overlapping booking
const CHECK_VIOLATION = "23514"; // ends_at <= starts_at

interface BookingRow {
  id: string;
  room_id: string;
  room_name: string;
  title: string;
  starts_at: string;
  ends_at: string;
  booked_by: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bookedBy: row.booked_by
  };
}

const BOOKING_SELECT = `
  SELECT b.id, b.room_id, r.name AS room_name, b.title,
         b.starts_at, b.ends_at, b.booked_by
    FROM bookings b
    JOIN rooms r ON r.id = b.room_id
`;

app.get("/api/rooms", wrap(async (_req, res) => {
  res.json(await query<Room>("SELECT id, name, capacity FROM rooms ORDER BY name"));
}));

// Optional filters: a specific room, and/or a single calendar day. The day
// filter uses range overlap (&&) so a booking spanning midnight still shows.
app.get("/api/bookings", wrap(async (req, res) => {
  const roomId = req.query.roomId ? uuid(req.query.roomId) : null;
  let start: string | null = null, end: string | null = null;
  if (req.query.dayStart !== undefined || req.query.dayEnd !== undefined) {
    start = timestamp(req.query.dayStart); end = timestamp(req.query.dayEnd);
    if (end <= start || Date.parse(end) - Date.parse(start) > 26 * 3600000) throw new ValidationError("Supply a forward day window no longer than 26 hours.");
  } else if (req.query.date !== undefined) {
    if (!realDate(req.query.date)) throw new ValidationError("Use a real YYYY-MM-DD date.");
    start = `${req.query.date}T00:00:00.000Z`;
    end = new Date(Date.parse(start) + 86400000).toISOString();
  }
  const rows = await query<BookingRow>(`${BOOKING_SELECT}
    WHERE ($1::uuid IS NULL OR b.room_id = $1)
      AND ($2::timestamptz IS NULL OR tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)'))
    ORDER BY b.starts_at, b.id`, [roomId, start, end]);
  res.json(rows.map(toBooking));
}));

app.post("/api/bookings", wrap(async (req, res) => {
  const input = parseBooking(req.body);
  const rows = await query<BookingRow>(
    `WITH inserted AS (
       INSERT INTO bookings (room_id, title, starts_at, ends_at, booked_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT i.id, i.room_id, r.name AS room_name, i.title, i.starts_at, i.ends_at, i.booked_by
       FROM inserted i JOIN rooms r ON r.id = i.room_id`,
    [input.roomId, input.title, input.startsAt, input.endsAt, input.bookedBy]
  );
  res.status(201).json(toBooking(rows[0]!));
}));

app.put("/api/bookings/:id", wrap(async (req, res) => {
  const input = parseBooking(req.body);
  const rows = await query<BookingRow>(
    `WITH updated AS (
       UPDATE bookings
          SET room_id = $2, title = $3, starts_at = $4, ends_at = $5, booked_by = $6
        WHERE id = $1
        RETURNING *
     )
     SELECT u.id, u.room_id, r.name AS room_name, u.title, u.starts_at, u.ends_at, u.booked_by
       FROM updated u JOIN rooms r ON r.id = u.room_id`,
    [uuid(req.params.id), input.roomId, input.title, input.startsAt, input.endsAt, input.bookedBy]
  );
  if (!rows[0]) return res.status(404).json({ error: "Booking not found." });
  res.json(toBooking(rows[0]));
}));

app.delete("/api/bookings/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM bookings WHERE id = $1", [uuid(req.params.id)]);
  if (rowCount === 0) return res.status(404).json({ error: "Booking not found." });
  res.status(204).send();
}));

// Turn database constraint violations into friendly HTTP responses.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  const code = (error as { code?: string }).code;
  if (code === EXCLUSION_VIOLATION) {
    return res.status(409).json({ error: "That room is already booked for an overlapping time." });
  }
  if (code === "23503") return res.status(400).json({ error: "Choose an existing room." });
  if (code === CHECK_VIOLATION) {
    return res.status(400).json({ error: "End time must be after the start time." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => console.log(`Room Booking API on http://localhost:${port}`));
}
