import { useEffect, useMemo, useState } from "react";
import { createEvent, deleteEvent, listEvents, updateEvent } from "./api";
import "./styles.css";

const blankEvent = {
  name: "",
  location: "",
  date: "",
  capacity: 50,
  registered: 0,
  status: "Open"
};

export default function App() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blankEvent);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshEvents();
  }, [filters]);

  const totalOpenSeats = useMemo(() => {
    return events.reduce((sum, event) => sum + event.capacity - event.registered, 0);
  }, [events]);

  async function refreshEvents() {
    try {
      setEvents(await listEvents(filters));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveEvent(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateEvent(editingId, form);
        setMessage("Event updated.");
      } else {
        await createEvent(form);
        setMessage("Event created.");
      }
      resetForm();
      await refreshEvents();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editEvent(event) {
    setEditingId(event.id);
    setForm(event);
  }

  async function removeEvent(id) {
    await deleteEvent(id);
    setMessage("Event deleted.");
    await refreshEvents();
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankEvent);
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Advanced Project 5</p>
          <h1>Event Admin</h1>
        </div>
        <strong>{totalOpenSeats} available seats</strong>
      </header>

      <section className="grid">
        <form className="panel" onSubmit={saveEvent}>
          <label htmlFor="field-name">Name</label>
          <input id="field-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />

          <label htmlFor="field-location">Location</label>
          <input id="field-location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />

          <label htmlFor="field-date">Date</label>
          <input id="field-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />

          <div className="field-row">
            <div>
              <label htmlFor="field-capacity">Capacity</label>
              <input id="field-capacity" type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            </div>
            <div>
              <label htmlFor="field-registered">Registered</label>
              <input id="field-registered" type="number" value={form.registered} onChange={(event) => setForm({ ...form, registered: event.target.value })} />
            </div>
          </div>

          <label htmlFor="field-status">Status</label>
          <select id="field-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option>Open</option>
            <option>Waitlist</option>
            <option>Closed</option>
          </select>

          <div className="actions">
            <button>{editingId ? "Update event" : "Create event"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p role="status" className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search events" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="all">All statuses</option>
              <option>Open</option>
              <option>Waitlist</option>
              <option>Closed</option>
            </select>
          </div>

          <div className="events">
            {events.map((event) => (
              <article className="event-card" key={event.id}>
                <h2>{event.name}</h2>
                <p>{event.location} · {event.date}</p>
                <p>{event.registered}/{event.capacity} registered · {event.status}</p>
                <div className="actions">
                  <button type="button" onClick={() => editEvent(event)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeEvent(event.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
