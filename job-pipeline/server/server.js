import express from "express";
import cors from "cors";

const app = express();
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

app.get("/api/applications", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const stage = String(req.query.stage || "all");
  const result = applications.filter((application) => {
    const text = `${application.company} ${application.role} ${application.contact}`.toLowerCase();
    return text.includes(search) && (stage === "all" || application.stage === stage);
  });
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

app.listen(port, () => {
  console.log(`Job Pipeline API listening on http://localhost:${port}`);
});

function validateApplication(req, res, next) {
  const application = normalizeApplication(req.body);
  const stages = ["Saved", "Applied", "Interviewing", "Offer", "Closed"];

  if (!application.company || !application.role) {
    return res.status(400).json({ error: "Company and role are required." });
  }

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
