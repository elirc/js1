import { useEffect, useState, type FormEvent } from "react";
import type { Agent, Label, NewTicket, Ticket, TicketEvent, TicketPriority, TicketStatus } from "../../shared/types";
import {
  createTicket,
  deleteTicket,
  listAgents,
  listEvents,
  listLabels,
  listTickets,
  setAssignee,
  setStatus,
  type TicketFilters
} from "./api";

const STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

const emptyForm: NewTicket = { subject: "", body: "", priority: "normal", assigneeId: null, labelIds: [] };

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filters, setFilters] = useState<TicketFilters>({ status: "", priority: "", label: "", search: "" });
  const [form, setForm] = useState<NewTicket>(emptyForm);
  const [openEvents, setOpenEvents] = useState<Record<string, TicketEvent[]>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    listAgents().then(setAgents).catch(reportError);
    listLabels().then(setLabels).catch(reportError);
  }, []);

  useEffect(() => {
    refresh();
  }, [filters]);

  function reportError(error: unknown) {
    setMessage((error as Error).message);
  }

  async function refresh() {
    try {
      setTickets(await listTickets(filters));
    } catch (error) {
      reportError(error);
    }
  }

  function toggleLabel(id: string) {
    setForm((current) => ({
      ...current,
      labelIds: current.labelIds.includes(id)
        ? current.labelIds.filter((labelId) => labelId !== id)
        : [...current.labelIds, id]
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createTicket(form);
      setForm(emptyForm);
      setMessage("Ticket created (with labels + audit event) in one transaction.");
      await refresh();
    } catch (error) {
      reportError(error);
    }
  }

  async function changeStatus(ticket: Ticket, status: TicketStatus) {
    await setStatus(ticket.id, status);
    await refresh();
    if (openEvents[ticket.id]) await showEvents(ticket.id);
  }

  async function changeAssignee(ticket: Ticket, assigneeId: string) {
    await setAssignee(ticket.id, assigneeId || null);
    await refresh();
    if (openEvents[ticket.id]) await showEvents(ticket.id);
  }

  async function showEvents(id: string) {
    if (openEvents[id]) {
      setOpenEvents((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    const events = await listEvents(id);
    setOpenEvents((current) => ({ ...current, [id]: events }));
  }

  async function remove(id: string) {
    await deleteTicket(id);
    await refresh();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 2</p>
          <h1>Support Tickets</h1>
        </div>
        <p className="muted">Many-to-many labels · audit log</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <h2>New ticket</h2>
          <label>Subject</label>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />

          <label>Details</label>
          <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

          <div className="field-row">
            <div>
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Assignee</label>
              <select value={form.assigneeId ?? ""} onChange={(e) => setForm({ ...form, assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <label>Labels</label>
          <div className="chip-picker">
            {labels.map((label) => (
              <button
                type="button"
                key={label.id}
                className={`chip ${label.color} ${form.labelIds.includes(label.id) ? "on" : ""}`}
                onClick={() => toggleLabel(label.id)}
              >
                {label.name}
              </button>
            ))}
          </div>

          <button type="submit">Create ticket</button>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input
              placeholder="Search subject/body"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <select value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.label ?? ""} onChange={(e) => setFilters({ ...filters, label: e.target.value })}>
              <option value="">All labels</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="cards">
            {tickets.map((ticket) => (
              <article className="card" key={ticket.id}>
                <header>
                  <h3>{ticket.subject}</h3>
                  <span className={`priority ${ticket.priority}`}>{ticket.priority}</span>
                </header>
                {ticket.body && <p>{ticket.body}</p>}
                <div className="chip-row">
                  {ticket.labels.map((label) => (
                    <span className={`chip ${label.color} on small`} key={label.id}>{label.name}</span>
                  ))}
                  {ticket.labels.length === 0 && <span className="muted small">No labels</span>}
                </div>

                <div className="controls">
                  <select value={ticket.status} onChange={(e) => changeStatus(ticket, e.target.value as TicketStatus)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={ticket.assignee?.id ?? ""} onChange={(e) => changeAssignee(ticket, e.target.value)}>
                    <option value="">Unassigned</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div className="actions">
                  <button type="button" className="secondary" onClick={() => showEvents(ticket.id)}>
                    {openEvents[ticket.id] ? "Hide history" : "History"}
                  </button>
                  <button type="button" className="danger" onClick={() => remove(ticket.id)}>Delete</button>
                </div>

                {openEvents[ticket.id] && (
                  <ul className="timeline">
                    {openEvents[ticket.id]!.map((event) => (
                      <li key={event.id}>
                        <span className="kind">{event.kind}</span>
                        <span>{event.detail}</span>
                        <time className="muted small">{new Date(event.createdAt).toLocaleString()}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            {tickets.length === 0 && <p className="muted">No tickets match these filters.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
