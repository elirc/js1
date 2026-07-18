import { useEffect, useState, type FormEvent } from "react";
import type { Movement, Product, StockLevel, Warehouse } from "../../shared/types";
import { listLedger, listProducts, listStock, listWarehouses, recordMovement, transfer } from "./api";

type MovementKind = "receive" | "issue";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [ledger, setLedger] = useState<{ productId: string; rows: Movement[] } | null>(null);
  const [message, setMessage] = useState("");

  const [adjust, setAdjust] = useState({ productId: "", warehouseId: "", kind: "receive" as MovementKind, quantity: 1, reason: "" });
  const [move, setMove] = useState({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: 1, reason: "" });

  useEffect(() => {
    Promise.all([listProducts(), listWarehouses()])
      .then(([p, w]) => {
        setProducts(p);
        setWarehouses(w);
        const firstProduct = p[0]?.id ?? "";
        const firstWh = w[0]?.id ?? "";
        const secondWh = w[1]?.id ?? firstWh;
        setAdjust((a) => ({ ...a, productId: firstProduct, warehouseId: firstWh }));
        setMove((m) => ({ ...m, productId: firstProduct, fromWarehouseId: firstWh, toWarehouseId: secondWh }));
      })
      .catch((error) => setMessage((error as Error).message));
    refreshStock();
  }, []);

  async function refreshStock() {
    try {
      setStock(await listStock());
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function submitAdjust(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const signed = adjust.kind === "issue" ? -Math.abs(adjust.quantity) : Math.abs(adjust.quantity);
      await recordMovement({ productId: adjust.productId, warehouseId: adjust.warehouseId, delta: signed, reason: adjust.reason });
      setMessage(`Recorded ${adjust.kind} of ${Math.abs(adjust.quantity)}.`);
      await refreshStock();
      await maybeRefreshLedger(adjust.productId);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await transfer(move);
      setMessage("Transfer committed atomically (two movements, one transaction).");
      await refreshStock();
      await maybeRefreshLedger(move.productId);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function viewLedger(productId: string) {
    if (ledger?.productId === productId) {
      setLedger(null);
      return;
    }
    setLedger({ productId, rows: await listLedger(productId) });
  }

  async function maybeRefreshLedger(productId: string) {
    if (ledger?.productId === productId) {
      setLedger({ productId, rows: await listLedger(productId) });
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 4</p>
          <h1>Warehouse Ledger</h1>
        </div>
        <p className="muted">Balances = SUM(movements) · atomic transfers</p>
      </section>

      <section className="grid">
        <div className="stack">
          <form className="panel" onSubmit={submitAdjust}>
            <h2>Receive / issue</h2>
            <label>Product</label>
            <select value={adjust.productId} onChange={(e) => setAdjust({ ...adjust, productId: e.target.value })}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label>Warehouse</label>
            <select value={adjust.warehouseId} onChange={(e) => setAdjust({ ...adjust, warehouseId: e.target.value })}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="field-row">
              <div>
                <label>Action</label>
                <select value={adjust.kind} onChange={(e) => setAdjust({ ...adjust, kind: e.target.value as MovementKind })}>
                  <option value="receive">Receive (+)</option>
                  <option value="issue">Issue (−)</option>
                </select>
              </div>
              <div>
                <label>Quantity</label>
                <input type="number" min="1" value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <label>Reason</label>
            <input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="PO #1234" />
            <button type="submit">Record movement</button>
          </form>

          <form className="panel" onSubmit={submitTransfer}>
            <h2>Transfer</h2>
            <label>Product</label>
            <select value={move.productId} onChange={(e) => setMove({ ...move, productId: e.target.value })}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="field-row">
              <div>
                <label>From</label>
                <select value={move.fromWarehouseId} onChange={(e) => setMove({ ...move, fromWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label>To</label>
                <select value={move.toWarehouseId} onChange={(e) => setMove({ ...move, toWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <label>Quantity</label>
            <input type="number" min="1" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: Number(e.target.value) })} />
            <button type="submit">Transfer stock</button>
          </form>

          <p className="message">{message}</p>
        </div>

        <section className="panel">
          <h2>Stock on hand</h2>
          <table className="stock">
            <thead>
              <tr><th>Product</th><th>Warehouse</th><th className="num">Balance</th><th className="num">Reorder</th><th></th></tr>
            </thead>
            <tbody>
              {stock.map((level) => (
                <tr key={`${level.productId}-${level.warehouseId}`} className={level.low ? "low" : ""}>
                  <td>
                    <strong>{level.productName}</strong>
                    <span className="muted small"> {level.sku}</span>
                  </td>
                  <td>{level.warehouseName}</td>
                  <td className="num">{level.balance}{level.low && <span className="flag">low</span>}</td>
                  <td className="num muted">{level.reorderPoint}</td>
                  <td><button type="button" className="link" onClick={() => viewLedger(level.productId)}>ledger</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {ledger && (
            <div className="ledger">
              <h3>Movement history</h3>
              <ul>
                {ledger.rows.map((row) => (
                  <li key={row.id}>
                    <span className={`delta ${row.delta < 0 ? "neg" : "pos"}`}>{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
                    <span>{row.warehouseName}</span>
                    <span className="muted">{row.reason || "—"}</span>
                    <time className="muted small">{new Date(row.createdAt).toLocaleString()}</time>
                  </li>
                ))}
                {ledger.rows.length === 0 && <li className="muted">No movements yet.</li>}
              </ul>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
