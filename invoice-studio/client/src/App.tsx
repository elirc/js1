import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Client, InvoiceStatus, InvoiceSummary, NewInvoiceItem } from "../../shared/types";
import {
  createClient,
  createInvoice,
  deleteInvoice,
  listClients,
  listInvoices,
  setStatus
} from "./api";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const emptyLine = (): NewInvoiceItem => ({ description: "", quantity: 1, unitPrice: 0 });

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [message, setMessage] = useState("");

  const [clientId, setClientId] = useState("");
  const [status, setStatusValue] = useState<InvoiceStatus>("draft");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxRate, setTaxRate] = useState(0);
  const [lines, setLines] = useState<NewInvoiceItem[]>([emptyLine()]);
  const [newClient, setNewClient] = useState({ name: "", email: "" });

  useEffect(() => {
    listClients().then(setClients).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [filter]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0),
    [lines]
  );
  const tax = useMemo(() => (subtotal * Number(taxRate)) / 100, [subtotal, taxRate]);

  async function refresh() {
    try {
      setInvoices(await listInvoices(filter));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  function updateLine(index: number, patch: Partial<NewInvoiceItem>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleAddClient() {
    try {
      const created = await createClient(newClient);
      setClients((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setNewClient({ name: "", email: "" });
      setMessage(`Added client ${created.name}.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createInvoice({ clientId, status, issuedDate, taxRate: Number(taxRate), items: lines });
      setLines([emptyLine()]);
      setTaxRate(0);
      setMessage("Invoice created in a single transaction.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function cycleStatus(invoice: InvoiceSummary) {
    const next = STATUSES[(STATUSES.indexOf(invoice.status) + 1) % STATUSES.length]!;
    await setStatus(invoice.id, next);
    await refresh();
  }

  async function remove(id: string) {
    await deleteInvoice(id);
    await refresh();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 1</p>
          <h1>Invoice Studio</h1>
        </div>
        <p className="muted">Atomic invoices · totals computed in SQL</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <h2>New invoice</h2>

          <label htmlFor="lesson-field-1">Client</label>
          <select id="lesson-field-1" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
            <option value="" disabled>Select a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <details className="inline-add">
            <summary>+ Add a new client</summary>
            <input placeholder="Name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
            <input placeholder="Email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
            <button type="button" className="secondary" onClick={handleAddClient}>Save client</button>
          </details>

          <div className="field-row">
            <div>
              <label htmlFor="lesson-field-2">Status</label>
              <select id="lesson-field-2" value={status} onChange={(event) => setStatusValue(event.target.value as InvoiceStatus)}>
                {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lesson-field-3">Issued</label>
              <input id="lesson-field-3" type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} />
            </div>
            <div>
              <label>Tax %</label>
              <input type="number" min="0" step="0.01" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} />
            </div>
          </div>

          <div className="lines-head">
            <label>Line items</label>
            <button type="button" className="secondary" onClick={() => setLines((c) => [...c, emptyLine()])}>+ Line</button>
          </div>
          {lines.map((line, index) => (
            <div className="line" key={index}>
              <input
                placeholder="Description"
                value={line.description}
                onChange={(event) => updateLine(index, { description: event.target.value })}
              />
              <input
                type="number" min="1" step="1" aria-label="Quantity"
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
              />
              <input
                type="number" min="0" step="0.01" aria-label="Unit price"
                value={line.unitPrice}
                onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })}
              />
              <button
                type="button" className="icon" aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
              >×</button>
            </div>
          ))}

          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{money.format(subtotal)}</dd></div>
            <div><dt>Tax</dt><dd>{money.format(tax)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{money.format(subtotal + tax)}</dd></div>
          </dl>

          <button type="submit">Create invoice</button>
          <p role="status" className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <h2>Invoices</h2>
            <select value={filter} onChange={(event) => setFilter(event.target.value as InvoiceStatus | "all")}>
              <option value="all">All statuses</option>
              {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="cards">
            {invoices.map((invoice) => (
              <article className="card" key={invoice.id}>
                <header>
                  <h3>{invoice.clientName}</h3>
                  <button type="button" className={`status ${invoice.status}`} onClick={() => cycleStatus(invoice)}>
                    {invoice.status}
                  </button>
                </header>
                <p className="muted">Issued {invoice.issuedDate} · tax {invoice.taxRate}%</p>
                <p className="amount">{money.format(invoice.total)}</p>
                <p className="muted small">
                  {money.format(invoice.subtotal)} + {money.format(invoice.tax)} tax
                </p>
                <div className="actions">
                  <button type="button" className="danger" onClick={() => remove(invoice.id)}>Delete</button>
                </div>
              </article>
            ))}
            {invoices.length === 0 && <p className="muted">No invoices for this filter.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
