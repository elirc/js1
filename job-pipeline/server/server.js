import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = 4104;
let applications = [
  {
    id: crypto.randomUUID(),
    company: "Acme Tools",
    role: "Frontend Engineer",
    stage: "Applied",
    contact: "Jordan",
    nextStepDate: "2026-07-02",
    notes: "Follow up after one week."
  }
];

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

app.get("/api/applications", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const stage = String(req.query.stage || "all");
  const result = applications.filter((application) => {
    const text = `${application.company} ${application.role} ${application.contact}`.toLowerCase();
    return text.includes(search) && (stage === "all" || application.stage === stage);
  });
  result.sort((a,b) => (a.nextStepDate || "9999-99-99").localeCompare(b.nextStepDate || "9999-99-99") || a.id.localeCompare(b.id));
  res.json(result);
});

app.post("/api/applications", validateApplication, (req, res) => {
  const application = { id: crypto.randomUUID(), ...normalizeApplication(req.body) };
  applications.unshift(application);
  res.status(201).json(application);
});

app.put("/api/applications/:id", validateApplication, (req, res) => {
  const existing = applications.find((application) => application.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Application not found." });
  }
  const updated = { ...existing, ...normalizeApplication(req.body) };
  applications = applications.map((application) => application.id === req.params.id ? updated : application);
  res.json(updated);
});

app.delete("/api/applications/:id", (req, res) => {
  const before = applications.length;
  applications = applications.filter((application) => application.id !== req.params.id);
  if (applications.length === before) {
    return res.status(404).json({ error: "Application not found." });
  }
  res.status(204).send();
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Job Pipeline API listening on http://localhost:${port}`);
});

function validateApplication(req, res, next) {
  if (!["company","role"].every(key => isText(req.body[key],1)) ||
      req.body.contact !== undefined && !isText(req.body.contact) || req.body.notes !== undefined && !isText(req.body.notes,0,10000) ||
      req.body.nextStepDate !== undefined && req.body.nextStepDate !== "" && !realDate(req.body.nextStepDate))
    return res.status(400).json({ error: "Use text fields and a real next-step date, or leave the date blank." });
  const application = normalizeApplication(req.body);
  const stages = ["Saved", "Applied", "Interviewing", "Offer", "Closed"];

  if (!stages.includes(application.stage)) {
    return res.status(400).json({ error: "Choose a valid stage." });
  }

  next();
}

function normalizeApplication(input) {
  return {
    company: String(input.company || "").trim(),
    role: String(input.role || "").trim(),
    stage: input.stage || "Saved",
    contact: String(input.contact || "").trim(),
    nextStepDate: input.nextStepDate || "",
    notes: String(input.notes || "").trim()
  };
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function realDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+"T00:00:00Z")) && new Date(value+"T00:00:00Z").toISOString().slice(0,10) === value; }
