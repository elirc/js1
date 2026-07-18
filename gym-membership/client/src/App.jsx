import { useEffect, useMemo, useState } from "react";
import { addActivity, createItem, deleteItem, getStats, listActivity, listItems, updateItem, updateStatus } from "./api";
import "./styles.css";

const STATUSES = ["Lead", "Active", "Paused", "Cancelled"];
const CATEGORIES = ["Strength", "Cardio", "Yoga", "Personal Training"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const emptyForm = { title: "", owner: "", category: CATEGORIES[0], status: STATUSES[0], amount: 0, priority: "Medium", dueDate: "", notes: "" };

export default function App() {
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, page: 1, pageSize: 6, sort: "createdAt", dir: "desc" });
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState({ search: "", status: "all", category: "all", page: 1, pageSize: 6, sort: "createdAt", dir: "desc" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activity, setActivity] = useState([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { refresh(); }, [query]);
  useEffect(() => { if (selectedId) loadActivity(selectedId); }, [selectedId]);

  const selected = useMemo(() => data.items.find((item) => item.id === selectedId), [data.items, selectedId]);

  async function refresh() {
    try {
      const [itemsPage, summary] = await Promise.all([listItems(query), getStats()]);
      setData(itemsPage);
      setStats(summary);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadActivity(id) {
    try { setActivity(await listActivity(id)); } catch (error) { setMessage(error.message); }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateItem(editingId, form);
        setMessage("Updated successfully.");
      } else {
        await createItem(form);
        setMessage("Created successfully.");
      }
      resetForm();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function edit(item) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setForm({ title: item.title, owner: item.owner, category: item.category, status: item.status, amount: item.amount, priority: item.priority, dueDate: item.dueDate, notes: item.notes });
  }

  async function changeStatus(item, status) {
    await updateStatus(item.id, status);
    await refresh();
    if (selectedId === item.id) await loadActivity(item.id);
  }

  async function remove(id) {
    await deleteItem(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }

  async function submitNote(event) {
    event.preventDefault();
    if (!selectedId || !note.trim()) return;
    await addActivity(selectedId, note);
    setNote("");
    await loadActivity(selectedId);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function patchQuery(patch, resetPage = true) {
    setQuery((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Complex CRUD</p>
          <h1>Gym Membership</h1>
        </div>
        <div className="stats">
          <span>Total <strong>{stats?.total ?? 0}</strong></span>
          <span>Monthly Fee <strong>{formatAmount(stats?.amountTotal ?? 0)}</strong></span>
        </div>
      </header>

      <section className="layout">
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit Membership" : "New Membership"}</h2>
          <label>Member Name</label>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label>Coach</label>
          <input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />

          <div className="field-row">
            <div>
              <label>Category</label>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            <div>
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
          </div>

          <div className="field-row">
            <div>
              <label>Priority</label>
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            <div>
              <label>Monthly Fee</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />
            </div>
          </div>

          <label>Due date</label>
          <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />

          <label>Notes</label>
          <textarea rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />

          <div className="actions">
            <button>{editingId ? "Update" : "Create"}</button>
            {editingId && <button className="secondary" type="button" onClick={resetForm}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            <input placeholder="Search" value={query.search} onChange={(event) => patchQuery({ search: event.target.value })} />
            <select value={query.status} onChange={(event) => patchQuery({ status: event.target.value })}><option value="all">All statuses</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={query.category} onChange={(event) => patchQuery({ category: event.target.value })}><option value="all">All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={query.sort} onChange={(event) => patchQuery({ sort: event.target.value })}><option value="createdAt">Newest</option><option value="dueDate">Due date</option><option value="amount">Monthly Fee</option><option value="priority">Priority</option></select>
          </div>

          <div className="cards">
            {data.items.map((item) => (
              <article className={"card " + (selectedId === item.id ? "selected" : "")} key={item.id} onClick={() => setSelectedId(item.id)}>
                <header><h3>{item.title}</h3><span>{item.priority}</span></header>
                <p>{item.owner} - {item.category}</p>
                <p>{item.status} - due {item.dueDate || "not set"} - {formatAmount(item.amount)}</p>
                <p>{item.notes || "No notes yet."}</p>
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => edit(item)}>Edit</button>
                  <select value={item.status} onChange={(event) => changeStatus(item, event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                  <button type="button" className="danger" onClick={() => remove(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>

          <div className="pager">
            <button className="secondary" disabled={data.page <= 1} onClick={() => patchQuery({ page: data.page - 1 }, false)}>Prev</button>
            <span>Page {data.page} / {data.totalPages} - {data.total} records</span>
            <button className="secondary" disabled={data.page >= data.totalPages} onClick={() => patchQuery({ page: data.page + 1 }, false)}>Next</button>
          </div>
        </section>

        <aside className="panel activity">
          <h2>Activity</h2>
          {selected ? <p className="selected-title">{selected.title}</p> : <p>Select a record to see activity.</p>}
          {selected && <form onSubmit={submitNote} className="note-form"><input placeholder="Add note" value={note} onChange={(event) => setNote(event.target.value)} /><button>Add</button></form>}
          <div className="timeline">{activity.map((entry) => <p key={entry.id}><strong>{entry.kind}</strong> {entry.body}<br /><small>{new Date(entry.createdAt).toLocaleString()}</small></p>)}</div>
        </aside>
      </section>
    </main>
  );
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

