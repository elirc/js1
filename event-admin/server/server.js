import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = 4105;
let events = [
  {
    id: crypto.randomUUID(),
    name: "JavaScript Study Night",
    location: "Community Lab",
    date: "2026-07-12",
    capacity: 40,
    registered: 22,
    status: "Open"
  }
];

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

app.get("/api/events", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const status = String(req.query.status || "all");
  const result = events.filter((event) => {
    const text = `${event.name} ${event.location}`.toLowerCase();
    return text.includes(search) && (status === "all" || event.status === status);
  });
  res.json(result);
});

app.post("/api/events", validateEvent, (req, res) => {
  const event = { id: crypto.randomUUID(), ...normalizeEvent(req.body) };
  events.unshift(event);
  res.status(201).json(event);
});

app.put("/api/events/:id", validateEvent, (req, res) => {
  const existing = events.find((event) => event.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Event not found." });
  }
  const updated = { ...existing, ...normalizeEvent(req.body) };
  events = events.map((event) => event.id === req.params.id ? updated : event);
  res.json(updated);
});

app.delete("/api/events/:id", (req, res) => {
  const before = events.length;
  events = events.filter((event) => event.id !== req.params.id);
  if (events.length === before) {
    return res.status(404).json({ error: "Event not found." });
  }
  res.status(204).send();
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Event Admin API listening on http://localhost:${port}`);
});

function validateEvent(req, res, next) {
  if (!["name","location"].every(key => isText(req.body[key],1)) || !realDate(req.body.date) || !whole(req.body.capacity,1,100000) || !whole(req.body.registered,0,100000))
    return res.status(400).json({ error: "Use text, a real calendar date and whole capacity/registration counts." });
  const event = normalizeEvent(req.body);
  // The type gate above already bounds both counts; only the cross-field rule remains here.
  if (event.registered > event.capacity) {
    return res.status(400).json({ error: "Registered count cannot exceed capacity." });
  }
  if (!["Open", "Waitlist", "Closed"].includes(event.status)) {
    return res.status(400).json({ error: "Choose a valid event status." });
  }
  next();
}

function normalizeEvent(input) {
  return {
    name: String(input.name || "").trim(),
    location: String(input.location || "").trim(),
    date: input.date || "",
    capacity: Number(input.capacity),
    registered: Number(input.registered),
    status: input.status || "Open"
  };
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function whole(value, min, max) { return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max; }
function realDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+"T00:00:00Z")) && new Date(value+"T00:00:00Z").toISOString().slice(0,10) === value; }
