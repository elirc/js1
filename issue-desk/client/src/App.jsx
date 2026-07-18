import { useEffect, useMemo, useState } from "react";
import { createIssue, deleteIssue, listIssues, updateIssue } from "./api";
import "./styles.css";

const emptyForm = {
  title: "",
  status: "Backlog",
  priority: "Medium",
  assignee: "",
  description: ""
};

export default function App() {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ status: "all", search: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshIssues();
  }, [filters]);

  const counts = useMemo(() => {
    return issues.reduce((summary, issue) => {
      summary[issue.status] = (summary[issue.status] || 0) + 1;
      return summary;
    }, {});
  }, [issues]);

  async function refreshIssues() {
    try {
      setIssues(await listIssues(filters));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateIssue(editingId, form);
        setMessage("Issue updated.");
      } else {
        await createIssue(form);
        setMessage("Issue created.");
      }
      resetForm();
      await refreshIssues();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(issue) {
    setEditingId(issue.id);
    setForm({
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assignee,
      description: issue.description
    });
  }

  async function removeIssue(id) {
    await deleteIssue(id);
    setMessage("Issue deleted.");
    await refreshIssues();
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Advanced Project 1</p>
          <h1>Issue Desk</h1>
        </div>
        <div className="stats">
          <span>Backlog {counts.Backlog || 0}</span>
          <span>In Progress {counts["In Progress"] || 0}</span>
          <span>Done {counts.Done || 0}</span>
        </div>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <label>Title</label>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label>Assignee</label>
          <input value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} />

          <div className="field-row">
            <div>
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Backlog</option>
                <option>In Progress</option>
                <option>Review</option>
                <option>Done</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>

          <label>Description</label>
          <textarea rows="5" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

          <div className="actions">
            <button type="submit">{editingId ? "Update issue" : "Create issue"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search issues" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="all">All statuses</option>
              <option>Backlog</option>
              <option>In Progress</option>
              <option>Review</option>
              <option>Done</option>
            </select>
          </div>

          <div className="cards">
            {issues.map((issue) => (
              <article className="card" key={issue.id}>
                <header>
                  <h2>{issue.title}</h2>
                  <span>{issue.priority}</span>
                </header>
                <p>{issue.description || "No description yet."}</p>
                <p className="muted">{issue.status} · {issue.assignee}</p>
                <div className="actions">
                  <button type="button" onClick={() => startEdit(issue)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeIssue(issue.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
