import express from "express";
import cors from "cors";
import { createNoteRepository } from "./repository.js";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4106);

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(here, "data", "notes.json");

export async function createApp(file = DATA_FILE) {
const app = express();
app.use(cors());
app.use(express.json({ limit: "128kb" }));
const repository = await createNoteRepository(file);
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get("/api/notes", wrap(async (req, res) => {
  const { search = "" } = req.query;
  if (typeof search !== "string" || search.length > 200) return res.status(400).json({ error: "Search must be text up to 200 characters." });
  res.json(await repository.list({ search }));
}));

app.post("/api/notes", validateNote, wrap(async (req, res) => {
  res.status(201).json(await repository.create(req.body));
}));

app.put("/api/notes/:id", validateNote, wrap(async (req, res) => {
  const note = await repository.update(req.params.id, req.body);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.json(note);
}));

app.patch("/api/notes/:id/pin", wrap(async (req, res) => {
  const note = await repository.togglePin(req.params.id);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.json(note);
}));

app.delete("/api/notes/:id", wrap(async (req, res) => {
  const removed = await repository.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.status(204).send();
}));

app.use((error, _req, res, _next) => {
  // Body-parser rejections (a body over the 128kb limit, malformed JSON) arrive
  // here carrying their own 4xx status. Collapsing them to 500 would tell the
  // client "the server is broken" about a request the client can fix, and would
  // make them indistinguishable from a real storage failure in the logs.
  const status = Number(error.status ?? error.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: "The request was rejected. Existing notes were preserved." });
  }
  console.error("Note storage operation failed:", error.message);
  res.status(500).json({ error: "Could not complete the operation. Existing notes were preserved." });
});
return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await createApp();
  app.listen(port, () => console.log(`Note Vault API listening on http://localhost:${port}`));
}

function validateNote(req, res, next) {
  const { title, body } = req.body || {};
  if (typeof title !== "string" || title.trim().length < 2 || title.length > 255) {
    return res.status(400).json({ error: "Title must be at least 2 characters." });
  }
  if (typeof body !== "string" || body.length > 100000) {
    return res.status(400).json({ error: "Body must be a string." });
  }
  next();
}

