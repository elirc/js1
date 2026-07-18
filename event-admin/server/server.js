import express from "express";
import cors from "cors";

const app = express();
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

app.listen(port, () => {
  console.log(`Event Admin API listening on http://localhost:${port}`);
});

function validateEvent(req, res, next) {
  const event = normalizeEvent(req.body);
  if (!event.name || !event.location || !event.date) {
    return res.status(400).json({ error: "Name, location, and date are required." });
  }
  if (event.capacity < 1 || event.registered < 0 || event.registered > event.capacity) {
    return res.status(400).json({ error: "Capacity and registered counts are invalid." });
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
