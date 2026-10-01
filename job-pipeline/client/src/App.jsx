import { useEffect, useMemo, useState } from "react";
import { createApplication, deleteApplication, listApplications, updateApplication } from "./api";
import "./styles.css";

const blankApplication = {
  company: "",
  role: "",
  stage: "Saved",
  contact: "",
  nextStepDate: "",
  notes: ""
};

const stages = ["Saved", "Applied", "Interviewing", "Offer", "Closed"];

export default function App() {
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(blankApplication);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", stage: "all" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApplications();
  }, [filters]);

  const stageCounts = useMemo(() => {
    return applications.reduce((counts, item) => {
      counts[item.stage] = (counts[item.stage] || 0) + 1;
      return counts;
    }, {});
  }, [applications]);

  async function loadApplications() {
    try {
      setApplications(await listApplications(filters));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveApplication(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateApplication(editingId, form);
        setMessage("Application updated.");
      } else {
        await createApplication(form);
        setMessage("Application created.");
      }
      resetForm();
      await loadApplications();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editApplication(application) {
    setEditingId(application.id);
    setForm(application);
  }

  async function removeApplication(id) {
    await deleteApplication(id);
    setMessage("Application deleted.");
    await loadApplications();
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankApplication);
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Advanced Project 4</p>
        <h1>Job Pipeline</h1>
      </header>

      <section className="grid">
        <form className="panel" onSubmit={saveApplication}>
          <label htmlFor="field-company">Company</label>
          <input id="field-company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />

          <label htmlFor="field-role">Role</label>
          <input id="field-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />

          <label htmlFor="field-stage">Stage</label>
          <select id="field-stage" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
            {stages.map((stage) => <option key={stage}>{stage}</option>)}
          </select>

          <label htmlFor="field-contact">Contact</label>
          <input id="field-contact" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />

          <label htmlFor="field-next-step-date">Next step date</label>
          <input id="field-next-step-date" type="date" value={form.nextStepDate} onChange={(event) => setForm({ ...form, nextStepDate: event.target.value })} />

          <label htmlFor="field-notes">Notes</label>
          <textarea id="field-notes" rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />

          <div className="actions">
            <button>{editingId ? "Update application" : "Create application"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p role="status" className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search applications" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}>
              <option value="all">All stages</option>
              {stages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </div>

          <div className="stage-strip">
            {stages.map((stage) => <span key={stage}>{stage}: {stageCounts[stage] || 0}</span>)}
          </div>

          <div className="cards">
            {applications.map((application) => (
              <article className="card" key={application.id}>
                <h2>{application.company}</h2>
                <p>{application.role} · {application.stage}</p>
                <p>{application.contact || "No contact"} · {application.nextStepDate || "No date"}</p>
                <p>{application.notes}</p>
                <div className="actions">
                  <button type="button" onClick={() => editApplication(application)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeApplication(application.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
