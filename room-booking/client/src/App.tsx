import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Booking, NewBooking, Room } from "../../shared/types";
import { createBooking, deleteBooking, listBookings, listRooms } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

// datetime-local gives "YYYY-MM-DDTHH:mm"; default to the next two whole hours.
function defaultSlot(dateStr: string, hourOffset: number) {
  const start = new Date(`${dateStr}T00:00`);
  start.setHours(new Date().getHours() + hourOffset, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateStr}T${pad(start.getHours())}:00`;
}

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(today());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState({ title: "", bookedBy: "", startsAt: "", endsAt: "" });
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    listRooms().then((data) => {
      setRooms(data);
      if (data[0]) setRoomId(data[0].id);
    }).catch((error) => setMessage((error as Error).message));
  }, []);

  useEffect(() => {
    if (roomId) refresh();
  }, [roomId, date]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      startsAt: current.startsAt || defaultSlot(date, 1),
      endsAt: current.endsAt || defaultSlot(date, 2)
    }));
  }, [date]);

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId) ?? null, [rooms, roomId]);

  async function refresh() {
    try {
      setBookings(await listBookings({ roomId, date }));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setConflict(false);
    try {
      await createBooking({ roomId, ...form } as NewBooking);
      setForm({ title: "", bookedBy: "", startsAt: defaultSlot(date, 1), endsAt: defaultSlot(date, 2) });
      setMessage("Booked. The database guaranteed no overlap.");
      await refresh();
    } catch (error) {
      // A 409 from the exclusion constraint lands here as a normal Error.
      setConflict(true);
      setMessage((error as Error).message);
    }
  }

  async function remove(id: string) {
    await deleteBooking(id);
    await refresh();
  }

  const timeFmt = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 3</p>
          <h1>Room Booking</h1>
        </div>
        <p className="muted">Overlaps blocked by a GiST exclusion constraint</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <h2>Reserve a slot</h2>

          <label>Room</label>
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>

          <label>Title</label>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label>Booked by</label>
          <input value={form.bookedBy} onChange={(event) => setForm({ ...form, bookedBy: event.target.value })} />

          <div className="field-row">
            <div>
              <label>Start</label>
              <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </div>
            <div>
              <label>End</label>
              <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </div>
          </div>

          <button type="submit">Book room</button>
          <p className={`message ${conflict ? "error" : ""}`}>{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <h2>{selectedRoom ? selectedRoom.name : "Schedule"}</h2>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          {selectedRoom && <p className="muted">Capacity {selectedRoom.capacity}</p>}

          <ul className="schedule">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <span className="time">
                  {timeFmt.format(new Date(booking.startsAt))}–{timeFmt.format(new Date(booking.endsAt))}
                </span>
                <span className="title">{booking.title}</span>
                <span className="muted small">{booking.bookedBy}</span>
                <button type="button" className="danger small-btn" onClick={() => remove(booking.id)}>Cancel</button>
              </li>
            ))}
            {bookings.length === 0 && <li className="muted empty">No bookings on this day — the room is free.</li>}
          </ul>
        </section>
      </section>
    </main>
  );
}
