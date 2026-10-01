import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = Number(process.env.PORT || 4230);
const STATUSES = ["Planning", "Active", "Paused", "Complete"];
const CATEGORIES = ["Email", "Social", "Events", "Paid Search"];
const SORTABLE = ["title", "owner", "category", "status", "priority", "dueDate", "amount", "createdAt"];

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

const repository = createRepository();

app.get("/api/campaigns", (req, res) => res.json(repository.query(normalizeQuery(req.query))));
app.get("/api/campaigns/stats", (_req, res) => res.json(repository.stats()));
app.get("/api/campaigns/:id", (req, res) => {
  const item = repository.find(req.params.id);
  if (!item) return res.status(404).json({ error: "Campaign not found." });
  res.json(item);
});
app.post("/api/campaigns", validateItem, (req, res) => res.status(201).json(repository.create(req.body)));
app.put("/api/campaigns/:id", validateItem, (req, res) => {
  const item = repository.update(req.params.id, req.body);
  if (!item) return res.status(404).json({ error: "Campaign not found." });
  res.json(item);
});
app.patch("/api/campaigns/:id/status", (req, res) => {
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Choose a valid status." });
  const item = repository.setStatus(req.params.id, status);
  if (!item) return res.status(404).json({ error: "Campaign not found." });
  res.json(item);
});
app.delete("/api/campaigns/:id", (req, res) => {
  const removed = repository.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: "Campaign not found." });
  res.status(204).send();
});
app.get("/api/campaigns/:id/activity", (req, res) => {
  if (!repository.find(req.params.id)) return res.status(404).json({ error: "Campaign not found." });
  res.json(repository.listActivity(req.params.id));
});
app.post("/api/campaigns/:id/activity", (req, res) => {
  if (typeof req.body.body !== "string" || !req.body.body.trim() || req.body.body.length > 2000 ||
      req.body.kind !== undefined && (typeof req.body.kind !== "string" || !req.body.kind.trim() || req.body.kind.length > 40))
    return res.status(400).json({ error: "Activity needs text of 1-2000 characters and an optional short kind." });
  const entry = repository.addActivity(req.params.id, req.body);
  if (!entry) return res.status(404).json({ error: "Campaign not found or activity was empty." });
  res.status(201).json(entry);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => console.log("Campaign Planner API listening on http://localhost:" + port));

function validateItem(req, res, next) {
  const body = req.body;
  if (["title","owner"].some(key => typeof body[key] !== "string" || body[key].trim().length > 200) ||
      ["notes","dueDate","priority","category","status"].some(key => body[key] !== undefined && typeof body[key] !== "string"))
    return res.status(400).json({ error: "Use text for record fields; title and owner allow at most 200 characters." });
  if (body.amount !== undefined && (typeof body.amount !== "number" && typeof body.amount !== "string" || String(body.amount).trim() === ""))
    return res.status(400).json({ error: "Amount must be a number." });
  if (body.dueDate && !validDate(body.dueDate)) return res.status(400).json({ error: "Use a real date in YYYY-MM-DD format." });
  if (body.notes?.length > 10000 || body.priority && !["Low","Medium","High","Critical"].includes(body.priority))
    return res.status(400).json({ error: "Choose a valid priority and keep notes under 10000 characters." });
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
  const page = pageNumber(query.page, 1, 1000000);
  const pageSize = pageNumber(query.pageSize, 6, 25);
  const sort = SORTABLE.includes(query.sort) ? query.sort : "createdAt";
  const dir = query.dir === "asc" ? "asc" : "desc";
  return { search: String(query.search || "").trim().toLowerCase(), status: String(query.status || "all"), category: String(query.category || "all"), page, pageSize, sort, dir };
}
function createRepository() {
  let items = [{"owner":"Nina Patel","dueDate":"2026-07-15","title":"Summer onboarding series","category":"Email","amount":5000,"status":"Planning","priority":"High","notes":"Needs lifecycle copy review."},{"owner":"Owen Brooks","dueDate":"2026-08-01","title":"Conference booth push","category":"Events","amount":18000,"status":"Active","priority":"Critical","notes":"Coordinate with sales enablement."}].map(seed);
  let activity = items.map((item) => ({ id: crypto.randomUUID(), itemId: item.id, kind: "created", body: "Seeded " + item.title, createdAt: item.createdAt }));
  return {
    query({ search, status, category, page, pageSize, sort, dir }) {
      let result = items.filter((item) => {
        const haystack = (item.title + " " + item.owner + " " + item.category + " " + item.status + " " + item.priority + " " + item.notes).toLowerCase();
        return (!search || haystack.includes(search)) && (status === "all" || item.status === status) && (category === "all" || item.category === category);
      });
      result = result.sort((a, b) => compareValues(a[sort], b[sort], dir) || a.id.localeCompare(b.id));
      const total = result.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, totalPages);
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
    setStatus(id, status) {
      const existing = this.find(id); if (!existing) return null;
      if (existing.status === status) return existing;
      const updated = { ...existing, status, updatedAt: now() };
      const entry = activityEntry(id, "status", "Changed status from " + existing.status + " to " + status);
      items = items.map(item => item.id === id ? updated : item); activity.unshift(entry);
      return updated;
    },
    remove(id) { const existing = this.find(id); if (!existing) return false; items = items.filter((item) => item.id !== id); activity.unshift(activityEntry(id, "deleted", "Deleted " + existing.title)); return true; },
    listActivity(itemId) { return activity.filter((entry) => entry.itemId === itemId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    addActivity(itemId, input) { if (!this.find(itemId)) return null; const body = String(input.body || "").trim(); if (!body) return null; const entry = activityEntry(itemId, String(input.kind || "note"), body); activity.unshift(entry); return entry; }
  };
}
function seed(input) { return { id: crypto.randomUUID(), ...input, createdAt: now(), updatedAt: now() }; }
function activityEntry(itemId, kind, body) { return { id: crypto.randomUUID(), itemId, kind, body, createdAt: now() }; }
function compareValues(left, right, dir) { const factor = dir === "asc" ? 1 : -1; if (typeof left === "number" && typeof right === "number") return (left - right) * factor; return String(left).localeCompare(String(right)) * factor; }
function now() { return new Date().toISOString(); }

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0,10) === value;
}
function pageNumber(value, fallback, maximum) {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number,maximum) : fallback;
}
