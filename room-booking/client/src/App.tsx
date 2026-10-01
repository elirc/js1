import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import type { Booking, NewBooking, Room } from "../../shared/types";
import { createBooking, updateBooking, deleteBooking, listBookings, listRooms } from "./api";

function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3,"0")}`;
}
const today = () => localInput(new Date()).slice(0,10);
function defaultSlot(dateStr: string, hourOffset: number) {
  const start = new Date(`${dateStr}T00:00`);
  start.setHours(new Date().getHours() + hourOffset, 0, 0, 0);
  return localInput(start);
}

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(today());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState({ title: "", bookedBy: "", startsAt: "", endsAt: "" });
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The instants the editor was opened with, and the exact datetime-local
  // strings we wrote into the inputs for them. <input type="datetime-local"
  // step="0.001"> keeps milliseconds in Chromium, but sub-second support is not
  // uniform: a browser that normalizes the value to whole minutes would make
  // "change only the title" silently shift the stored instant. If a field still
  // holds the string we wrote, we send the original instant instead of
  // re-parsing what the input gave back.
  const original = useRef<{ startsAt: string; endsAt: string; startsAtInput: string; endsAtInput: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    listRooms().then((data) => {
      setRooms(data);
      if (data[0]) setRoomId(data[0].id);
    }).catch((error) => setMessage((error as Error).message));
  }, []);

  useEffect(() => {
    if (roomId) refresh();
    return () => { requestVersion.current += 1; };
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
    const version = ++requestVersion.current;
    try {
      const data = await listBookings({ roomId, date });
      if (version === requestVersion.current) setBookings(data);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setConflict(false);
    if (busy) return;
    setBusy(true);
    try {
      const kept = original.current;
      const input: NewBooking = {
        roomId,
        ...form,
        startsAt: kept && form.startsAt === kept.startsAtInput ? kept.startsAt : new Date(form.startsAt).toISOString(),
        endsAt: kept && form.endsAt === kept.endsAtInput ? kept.endsAt : new Date(form.endsAt).toISOString()
      };
      if (editingId) await updateBooking(editingId, input);
      else await createBooking(input);
      setEditingId(null);
      original.current = null;
      setForm({ title: "", bookedBy: "", startsAt: defaultSlot(date, 1), endsAt: defaultSlot(date, 2) });
      setMessage(editingId ? "Booking updated." : "Room booked.");
      await refresh();
    } catch (error) {
      // A 409 from the exclusion constraint lands here as a normal Error.
      setConflict(true);
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await deleteBooking(id); if (editingId === id) cancelEdit(); await refresh(); }
    catch (error) { setConflict(true); setMessage((error as Error).message); }
  }

  function cancelEdit() {
    setEditingId(null);
    original.current = null;
    setForm({ title: "", bookedBy: "", startsAt: defaultSlot(date,1), endsAt: defaultSlot(date,2) });
  }
  function edit(booking: Booking) {
    setEditingId(booking.id);
    const startsAtInput = localInput(new Date(booking.startsAt));
    const endsAtInput = localInput(new Date(booking.endsAt));
    original.current = { startsAt: booking.startsAt, endsAt: booking.endsAt, startsAtInput, endsAtInput };
    setForm({ title: booking.title, bookedBy: booking.bookedBy, startsAt: startsAtInput, endsAt: endsAtInput });
    setMessage("Update the booking details, then save your changes.");
  }
  const timeFmt = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Project 3</p>
          <h1>Room Booking</h1>
        </div>
        <p className="muted">Reserve a room and manage your bookings</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit booking" : "Reserve a slot"}</h2>

          <label htmlFor="room">Room</label>
          <select id="room" value={roomId} onChange={(event) => { cancelEdit(); setRoomId(event.target.value); }}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>

          <label htmlFor="title">Title</label>
          <input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label htmlFor="booked-by">Booked by</label>
          <input id="booked-by" value={form.bookedBy} onChange={(event) => setForm({ ...form, bookedBy: event.target.value })} />

          <div className="field-row">
            <div>
              <label htmlFor="starts-at">Start</label>
              <input id="starts-at" type="datetime-local" step="0.001" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </div>
            <div>
              <label htmlFor="ends-at">End</label>
              <input id="ends-at" type="datetime-local" step="0.001" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </div>
          </div>

          <button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Book room"}</button>
          {editingId && <button type="button" onClick={cancelEdit} disabled={busy}>Discard edit</button>}
          <p role="status" className={`message ${conflict ? "error" : ""}`}>{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <h2>{selectedRoom ? selectedRoom.name : "Schedule"}</h2>
            <input aria-label="Schedule date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          {selectedRoom && <p className="muted">Capacity {selectedRoom.capacity}</p>}

          <ul className="schedule">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <span className="time">
                  {timeFmt.format(new Date(booking.startsAt))} to {timeFmt.format(new Date(booking.endsAt))}
                </span>
                <span className="title">{booking.title}</span>
                <span className="muted small">{booking.bookedBy}</span>
                <button type="button" className="small-btn" onClick={() => edit(booking)}>Edit</button>
                <button type="button" className="danger small-btn" onClick={() => remove(booking.id)}>Cancel</button>
              </li>
            ))}
            {bookings.length === 0 && <li className="muted empty">No bookings on this day - the room is free.</li>}
          </ul>
        </section>
      </section>
    </main>
  );
}
