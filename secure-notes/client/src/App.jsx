import { useEffect, useState } from "react";
import {
  createNote,
  deleteNote,
  getToken,
  listNotes,
  login,
  logout,
  me,
  register,
  updateNote,
} from "./api";
import "./styles.css";

const emptyForm = { title: "", body: "" };

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Restore a session on load if a token is already stored.
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <main className="auth-shell">
        <p className="muted">Checking session…</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  return <NotesScreen user={user} onLogout={() => setUser(null)} />;
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const user = mode === "login" ? await login(form) : await register(form);
      onAuthed(user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="auth-shell">
      <form className="panel auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Advanced Project 8</p>
        <h1>Secure Notes</h1>
        <p className="muted">
          {mode === "login" ? "Sign in to your notes." : "Create an account."}
        </p>

        <label htmlFor="lesson-field-1">Email</label>
        <input
          id="lesson-field-1"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />

        <label htmlFor="lesson-field-2">Password</label>
        <input
          id="lesson-field-2"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
        />

        <button type="submit">
          {mode === "login" ? "Sign in" : "Register"}
        </button>
        <p role="status" className="message">
          {message}
        </p>

        <p className="switch">
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMessage("");
            }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  );
}

function NotesScreen({ user, onLogout }) {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      setNotes(await listNotes());
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateNote(editingId, form);
        setMessage("Note updated.");
      } else {
        await createNote(form);
        setMessage("Note added.");
      }
      reset();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(note) {
    setEditingId(note.id);
    setForm({ title: note.title, body: note.body });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function remove(id) {
    await deleteNote(id);
    if (editingId === id) reset();
    await refresh();
  }

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Advanced Project 8</p>
          <h1>Secure Notes</h1>
        </div>
        <div className="account">
          <span className="muted">{user.email}</span>
          <button type="button" className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <label htmlFor="lesson-field-3">Title</label>
          <input
            id="lesson-field-3"
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />

          <label htmlFor="lesson-field-4">Body</label>
          <textarea
            id="lesson-field-4"
            rows="6"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />

          <div className="actions">
            <button type="submit">
              {editingId ? "Save note" : "Add note"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
          <p role="status" className="message">
            {message}
          </p>
        </form>

        <section className="panel">
          <h2>Your notes</h2>
          <div className="cards">
            {notes.map((note) => (
              <article className="card" key={note.id}>
                <h3>{note.title}</h3>
                <p>{note.body || "No body yet."}</p>
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => startEdit(note)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(note.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {notes.length === 0 && (
              <p className="muted">No notes yet — only you can see these.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
