import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 4224);
const STATUSES = ["Open", "Scheduled", "In Progress", "Completed"];
const CATEGORIES = ["HVAC", "Electrical", "Network", "Safety"];
const SORTABLE = ["title", "owner", "category", "status", "priority", "dueDate", "amount", "createdAt"];

app.use(cors());
app.use(express.json());

const repository = createRepository();

app.get("/api/work-orders", (req, res) => res.json(repository.query(normalizeQuery(req.query))));
app.get("/api/work-orders/stats", (_req, res) => res.json(repository.stats()));
app.get("/api/work-orders/:id", (req, res) => {
  const item = repository.find(req.params.id);
  if (!item) return res.status(404).json({ error: "WorkOrder not found." });
  res.json(item);
});
app.post("/api/work-orders", validateItem, (req, res) => res.status(201).json(repository.create(req.body)));
app.put("/api/work-orders/:id", validateItem, (req, res) => {
  const item = repository.update(req.params.id, req.body);
  if (!item) return res.status(404).json({ error: "WorkOrder not found." });
  res.json(item);
});
app.patch("/api/work-orders/:id/status", (req, res) => {
  const status = String(req.body.status || "");
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Choose a valid status." });
  const item = repository.setStatus(req.params.id, status);
  if (!item) return res.status(404).json({ error: "WorkOrder not found." });
  res.json(item);
});
app.delete("/api/work-orders/:id", (req, res) => {
  const removed = repository.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: "WorkOrder not found." });
  res.status(204).send();
});
app.get("/api/work-orders/:id/activity", (req, res) => {
  if (!repository.find(req.params.id)) return res.status(404).json({ error: "WorkOrder not found." });
  res.json(repository.listActivity(req.params.id));
});
app.post("/api/work-orders/:id/activity", (req, res) => {
  const entry = repository.addActivity(req.params.id, req.body);
  if (!entry) return res.status(404).json({ error: "WorkOrder not found or activity was empty." });
  res.status(201).json(entry);
});

app.listen(port, () => console.log("Equipment Maintenance API listening on http://localhost:" + port));

function validateItem(req, res, next) {
  const input = normalizeItem(req.body);
  if (input.title.length < 2) return res.status(400).json({ error: "Title must be at least 2 characters." });
  if (input.owner.length < 2) return res.status(400).json({ error: "Owner must be at least 2 characters." });
  if (!STATUSES.includes(input.status)) return res.status(400).json({ error: "Choose a valid status." });
  if (!CATEGORIES.includes(input.category)) return res.status(400).json({ error: "Choose a valid category." });
  if (!Number.isFinite(input.amount) || input.amount < 0) return res.status(400).json({ error: "Amount must be zero or greater." });
  req.body = input;
  next();
}
function normalizeItem(input) {
  return { title: String(input.title || "").trim(), owner: String(input.owner || "").trim(), category: String(input.category || CATEGORIES[0]).trim(), status: String(input.status || STATUSES[0]).trim(), amount: Number(input.amount || 0), priority: String(input.priority || "Medium").trim(), dueDate: String(input.dueDate || "").trim(), notes: String(input.notes || "").trim() };
}
function normalizeQuery(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(25, Math.max(1, Number(query.pageSize) || 6));
  const sort = SORTABLE.includes(query.sort) ? query.sort : "createdAt";
  const dir = query.dir === "asc" ? "asc" : "desc";
  return { search: String(query.search || "").trim().toLowerCase(), status: String(query.status || "all"), category: String(query.category || "all"), page, pageSize, sort, dir };
}
function createRepository() {
  let items = [{"owner":"Riley Gomez","dueDate":"2026-07-02","title":"Lobby HVAC unit","category":"HVAC","amount":450,"status":"Scheduled","priority":"High","notes":"Replacement filter already ordered."},{"owner":"Alex Morgan","dueDate":"2026-07-06","title":"Server room UPS","category":"Electrical","amount":900,"status":"Open","priority":"Critical","notes":"Battery health warning from monitor."}].map(seed);
  let activity = items.map((item) => ({ id: crypto.randomUUID(), itemId: item.id, kind: "created", body: "Seeded " + item.title, createdAt: item.createdAt }));
  return {
    query({ search, status, category, page, pageSize, sort, dir }) {
      let result = items.filter((item) => {
        const haystack = (item.title + " " + item.owner + " " + item.category + " " + item.status + " " + item.priority + " " + item.notes).toLowerCase();
        return (!search || haystack.includes(search)) && (status === "all" || item.status === status) && (category === "all" || item.category === category);
      });
      result = result.sort((a, b) => compareValues(a[sort], b[sort], dir));
      const total = result.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      return { items: result.slice(start, start + pageSize), total, totalPages, page, pageSize, sort, dir };
    },
    stats() {
      const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
      const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
      const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);
      for (const item of items) { byStatus[item.status] += 1; byCategory[item.category] += 1; }
      return { total: items.length, amountTotal, byStatus, byCategory };
    },
    find(id) { return items.find((item) => item.id === id); },
    create(input) { const item = { id: crypto.randomUUID(), ...input, createdAt: now(), updatedAt: now() }; items.unshift(item); activity.unshift(activityEntry(item.id, "created", "Created " + item.title)); return item; },
    update(id, input) { const existing = this.find(id); if (!existing) return null; const updated = { ...existing, ...input, updatedAt: now() }; items = items.map((item) => item.id === id ? updated : item); activity.unshift(activityEntry(id, "updated", "Updated " + updated.title)); return updated; },
    setStatus(id, status) { const existing = this.find(id); if (!existing) return null; return this.update(id, { ...existing, status }); },
    remove(id) { const existing = this.find(id); if (!existing) return false; items = items.filter((item) => item.id !== id); activity.unshift(activityEntry(id, "deleted", "Deleted " + existing.title)); return true; },
    listActivity(itemId) { return activity.filter((entry) => entry.itemId === itemId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    addActivity(itemId, input) { if (!this.find(itemId)) return null; const body = String(input.body || "").trim(); if (!body) return null; const entry = activityEntry(itemId, String(input.kind || "note"), body); activity.unshift(entry); return entry; }
  };
}
function seed(input) { return { id: crypto.randomUUID(), ...input, createdAt: now(), updatedAt: now() }; }
function activityEntry(itemId, kind, body) { return { id: crypto.randomUUID(), itemId, kind, body, createdAt: now() }; }
function compareValues(left, right, dir) { const factor = dir === "asc" ? 1 : -1; if (typeof left === "number" && typeof right === "number") return (left - right) * factor; return String(left).localeCompare(String(right)) * factor; }
function now() { return new Date().toISOString(); }
