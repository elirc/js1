import { useEffect, useMemo, useState } from "react";
import type { DailyMetric, Freshness, Summary, TopProduct } from "../../shared/types";
import { addSampleEvents, getDaily, getFreshness, getSummary, getTopProducts, refreshView } from "./api";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const RANGES = [7, 30, 90];

export default function App() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [fresh, setFresh] = useState<Freshness | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, [days]);

  async function loadAll() {
    try {
      const [s, d, t, f] = await Promise.all([
        getSummary(days),
        getDaily(days),
        getTopProducts(days),
        getFreshness()
      ]);
      setSummary(s);
      setDaily(d);
      setTop(t);
      setFresh(f);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function handleSample() {
    setBusy(true);
    try {
      setFresh(await addSampleEvents());
      setMessage("Added 250 recent events — the view is now behind until you refresh.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    try {
      await refreshView();
      setMessage("Materialized view refreshed (CONCURRENTLY).");
      await loadAll();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const maxRevenue = useMemo(
    () => daily.reduce((max, day) => Math.max(max, day.revenue), 0) || 1,
    [daily]
  );
  const maxProductRevenue = useMemo(
    () => top.reduce((max, p) => Math.max(max, p.revenue), 0) || 1,
    [top]
  );

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 8</p>
          <h1>Pulse Analytics</h1>
          <p className="muted small">Materialized view · window functions</p>
        </div>
        <div className="controls">
          <div className="range">
            {RANGES.map((r) => (
              <button key={r} type="button" className={r === days ? "active" : ""} onClick={() => setDays(r)}>
                {r}d
              </button>
            ))}
          </div>
          <button type="button" className="secondary" disabled={busy} onClick={handleSample}>+ Sample events</button>
          <button type="button" disabled={busy} onClick={handleRefresh}>Refresh view</button>
        </div>
      </header>

      {fresh?.stale && (
        <div className="banner">
          The materialized view is behind by <strong>{fresh.totalEvents - fresh.viewEvents}</strong> events.
          Numbers below won&apos;t reflect them until you <button type="button" className="link" onClick={handleRefresh}>refresh</button>.
        </div>
      )}

      {summary && (
        <section className="cards">
          <Card label={`Revenue (${summary.days}d)`} value={money.format(summary.revenue)} />
          <Card label="Orders" value={summary.orders.toLocaleString()} />
          <Card label="Conversion" value={`${(summary.conversion * 100).toFixed(1)}%`} sub={`${summary.views.toLocaleString()} views`} />
          <Card label="Avg order value" value={money.format(summary.avgOrderValue)} />
        </section>
      )}

      <section className="grid">
        <section className="panel">
          <h2>Daily revenue</h2>
          <div className="chart">
            {daily.map((day) => (
              <div className="bar-col" key={day.day} title={`${day.day}: ${money.format(day.revenue)}`}>
                <div className="bar" style={{ height: `${(day.revenue / maxRevenue) * 100}%` }} />
              </div>
            ))}
            {daily.length === 0 && <p className="muted">No data in range.</p>}
          </div>

          <table className="series">
            <thead>
              <tr><th>Day</th><th className="num">Revenue</th><th className="num">7-day avg</th><th className="num">Δ vs prev</th></tr>
            </thead>
            <tbody>
              {[...daily].reverse().slice(0, 10).map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td>
                  <td className="num">{money.format(day.revenue)}</td>
                  <td className="num muted">{money.format(day.revenueMa7)}</td>
                  <td className={`num ${deltaClass(day.revenueDelta)}`}>{formatDelta(day.revenueDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Top products</h2>
          <ul className="leaderboard">
            {top.map((product) => (
              <li key={product.product}>
                <span className="rank">#{product.rank}</span>
                <div className="lb-main">
                  <div className="lb-head">
                    <strong>{product.product}</strong>
                    <span>{money.format(product.revenue)}</span>
                  </div>
                  <div className="lb-bar" style={{ width: `${(product.revenue / maxProductRevenue) * 100}%` }} />
                  <span className="muted small">{product.orders} orders</span>
                </div>
              </li>
            ))}
            {top.length === 0 && <p className="muted">No purchases in range.</p>}
          </ul>
        </section>
      </section>

      <p role="status" className="message">{message}</p>
    </main>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <span className="card-value">{value}</span>
      {sub && <span className="card-sub muted small">{sub}</span>}
    </div>
  );
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${money.format(delta)}`;
}

function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "";
  return delta > 0 ? "up" : "down";
}
