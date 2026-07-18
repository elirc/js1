import { useEffect, useState } from "react";
import { createNote, deleteNote, listNotes, togglePin, updateNote } from "./api";
import "./styles.css";

const emptyForm = { title: "", body: "" };

export default function App() {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, [search]);

  async function refresh() {
    try {
      setNotes(await listNotes({ search }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateNote(editingId, form);
        setMessage("Note saved to disk.");
      } else {
        await createNote(form);
        setMessage("Note written to notes.json.");
      }
      resetForm();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(note) {
    setEditingId(note.id);
    setForm({ title: note.title, body: note.body });
  }

  async function pin(id) {
    await togglePin(id);
    await refresh();
  }

  async function remove(id) {
    await deleteNote(id);
    if (editingId === id) resetForm();
    setMessage("Note removed from disk.");
    await refresh();
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Advanced Project 6</p>
          <h1>Note Vault</h1>
        </div>
        <p className="muted">Persisted to <code>server/data/notes.json</code></p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <label>Title</label>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label>Body</label>
          <textarea rows="8" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />

          <div className="actions">
            <button type="submit">{editingId ? "Save note" : "Add note"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search notes" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="cards">
            {notes.map((note) => (
              <article className={`card ${note.pinned ? "pinned" : ""}`} key={note.id}>
                <header>
                  <h2>{note.title}</h2>
                  {note.pinned && <span className="pin-flag">Pinned</span>}
                </header>
                <p>{note.body || "No body yet."}</p>
                <p className="muted">Updated {new Date(note.updatedAt).toLocaleString()}</p>
                <div className="actions">
                  <button type="button" className="secondary" onClick={() => pin(note.id)}>
                    {note.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" onClick={() => startEdit(note)}>Edit</button>
                  <button type="button" className="danger" onClick={() => remove(note.id)}>Delete</button>
                </div>
              </article>
            ))}
            {notes.length === 0 && <p className="muted">No notes match your search.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
