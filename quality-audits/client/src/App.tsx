import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ActivityEntry, Item, NewItem, Page, Stats } from "../../shared/types";
import { addActivity, createItem, deleteItem, getStats, listActivity, listItems, updateItem, updateStatus } from "./api";

const STATUSES = ["Planned", "In Progress", "Needs Remediation", "Passed", "Failed"];
const CATEGORIES = ["Process", "Security", "Manufacturing", "Customer Support"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const emptyForm: NewItem = { title: "", owner: "", category: CATEGORIES[0], status: STATUSES[0], amount: 0, priority: "Medium", dueDate: "", notes: "" };

export default function App() {
  const [data, setData] = useState<Page<Item>>({ items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState({ search: "", status: "all", category: "all", page: 1, pageSize: 6, sort: "createdAt", dir: "desc" });
  const [form, setForm] = useState<NewItem>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { refresh(); }, [query]);
  useEffect(() => { if (selectedId) listActivity(selectedId).then(setActivity).catch(report); }, [selectedId]);

  const selected = useMemo(() => data.items.find((item) => item.id === selectedId), [data.items, selectedId]);

  function report(error: unknown) {
    setMessage((error as Error).message);
  }

  async function refresh() {
    try {
      const [page, summary] = await Promise.all([listItems(query), getStats()]);
      setData(page);
      setStats(summary);
    } catch (error) {
      report(error);
    }
  }

  function patchQuery(patch: Partial<typeof query>, resetPage = true) {
    setQuery((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }

  function edit(item: Item) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setForm({ title: item.title, owner: item.owner, category: item.category, status: item.status, amount: item.amount, priority: item.priority, dueDate: item.dueDate, notes: item.notes });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      editingId ? await updateItem(editingId, form) : await createItem(form);
      resetForm();
      await refresh();
      setMessage("Saved.");
    } catch (error) {
      report(error);
    }
  }

  async function changeStatus(item: Item, status: string) {
    try {
      await updateStatus(item.id, status);
      await refresh();
      if (selectedId === item.id) setActivity(await listActivity(item.id));
    } catch (error) {
      report(error);
    }
  }

  async function remove(id: string) {
    try {
      await deleteItem(id);
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch (error) {
      report(error);
    }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !note.trim()) return;
    try {
      await addActivity(selectedId, note);
      setNote("");
      setActivity(await listActivity(selectedId));
    } catch (error) {
      report(error);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">TS React Node Postgres</p>
          <h1>Quality Audits</h1>
        </div>
        <div className="stats">
          <span>Total <strong>{stats?.total ?? 0}</strong></span>
          <span>Finding Count <strong>{formatMoney(stats?.amountTotal ?? 0)}</strong></span>
        </div>
      </header>

      <section className="layout">
        <form className="panel" onSubmit={save}>
          <h2>{editingId ? "Edit Audit" : "New Audit"}</h2>
          <label htmlFor="lesson-field-1">Audit Name</label>
          <input id="lesson-field-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <label htmlFor="lesson-field-2">Auditor</label>
          <input id="lesson-field-2" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
          <div className="field-row">
            <div>
              <label htmlFor="lesson-field-3">Category</label>
              <select id="lesson-field-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            <div>
              <label htmlFor="lesson-field-4">Status</label>
              <select id="lesson-field-4" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
          </div>
          <div className="field-row">
            <div>
              <label htmlFor="lesson-field-5">Priority</label>
              <select id="lesson-field-5" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            <div>
              <label htmlFor="lesson-field-6">Finding Count</label>
              <input id="lesson-field-6" type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />
            </div>
          </div>
          <label htmlFor="lesson-field-7">Due date</label>
          <input id="lesson-field-7" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          <label htmlFor="lesson-field-8">Notes</label>
          <textarea id="lesson-field-8" rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <div className="actions">
            <button>{editingId ? "Update" : "Create"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p role="status" className="message">{message}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            <input placeholder="Search" value={query.search} onChange={(event) => patchQuery({ search: event.target.value })} />
            <select value={query.status} onChange={(event) => patchQuery({ status: event.target.value })}><option value="all">All statuses</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={query.category} onChange={(event) => patchQuery({ category: event.target.value })}><option value="all">All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={query.sort} onChange={(event) => patchQuery({ sort: event.target.value })}><option value="createdAt">Newest</option><option value="dueDate">Due date</option><option value="amount">Finding Count</option><option value="priority">Priority</option></select>
          </div>
          <div className="cards">{data.items.map((item) => (
            <article className={"card " + (selectedId === item.id ? "selected" : "")} key={item.id} onClick={() => setSelectedId(item.id)}>
              <header><h3>{item.title}</h3><span>{item.priority}</span></header>
              <p>{item.owner} - {item.category}</p>
              <p>{item.status} - due {item.dueDate || "not set"} - {formatMoney(item.amount)}</p>
              <p>{item.notes || "No notes yet."}</p>
              <div className="actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => edit(item)}>Edit</button>
                <select value={item.status} onChange={(event) => changeStatus(item, event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                <button type="button" className="danger" onClick={() => remove(item.id)}>Delete</button>
              </div>
            </article>
          ))}</div>
          <div className="pager">
            <button className="secondary" disabled={data.page <= 1} onClick={() => patchQuery({ page: data.page - 1 }, false)}>Prev</button>
            <span>Page {data.page} / {data.totalPages} - {data.total} records</span>
            <button className="secondary" disabled={data.page >= data.totalPages} onClick={() => patchQuery({ page: data.page + 1 }, false)}>Next</button>
          </div>
        </section>

        <aside className="panel">
          <h2>Activity</h2>
          {selected ? <p className="selected-title">{selected.title}</p> : <p>Select a record.</p>}
          {selected && <form className="note-form" onSubmit={saveNote}><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add note" /><button>Add</button></form>}
          <div className="timeline">{activity.map((entry) => <p key={entry.id}><strong>{entry.kind}</strong> {entry.body}<br /><small>{new Date(entry.createdAt).toLocaleString()}</small></p>)}</div>
        </aside>
      </section>
    </main>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
