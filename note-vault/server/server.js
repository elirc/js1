import express from "express";
import cors from "cors";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = 4106;

app.use(cors());
app.use(express.json());

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(here, "data", "notes.json");

const repository = await createNoteRepository(DATA_FILE);

app.get("/api/notes", async (req, res) => {
  const { search = "" } = req.query;
  res.json(await repository.list({ search }));
});

app.post("/api/notes", validateNote, async (req, res) => {
  res.status(201).json(await repository.create(req.body));
});

app.put("/api/notes/:id", validateNote, async (req, res) => {
  const note = await repository.update(req.params.id, req.body);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.json(note);
});

app.patch("/api/notes/:id/pin", async (req, res) => {
  const note = await repository.togglePin(req.params.id);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.json(note);
});

app.delete("/api/notes/:id", async (req, res) => {
  const removed = await repository.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Note not found." });
  }
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Note Vault API listening on http://localhost:${port}`);
  console.log(`Notes are persisted to ${DATA_FILE}`);
});

function validateNote(req, res, next) {
  const { title, body } = req.body;
  if (!title || title.trim().length < 2) {
    return res.status(400).json({ error: "Title must be at least 2 characters." });
  }
  if (typeof body !== "string") {
    return res.status(400).json({ error: "Body must be a string." });
  }
  next();
}

// The repository reads and writes a JSON file on disk. Every mutation
// rewrites the whole file, so data survives a server restart.
async function createNoteRepository(file) {
  async function readAll() {
    try {
      const raw = await readFile(file, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      // First run: the file (or its folder) doesn't exist yet. Seed it.
      if (error.code === "ENOENT") {
        const seed = [
          {
            id: crypto.randomUUID(),
            title: "Welcome",
            body: "This note lives in server/data/notes.json. Restart the server and it will still be here.",
            pinned: true,
            updatedAt: new Date().toISOString()
          }
        ];
        await writeAll(seed);
        return seed;
      }
      throw error;
    }
  }

  async function writeAll(notes) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(notes, null, 2));
  }

  function sort(notes) {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  return {
    async list({ search }) {
      const notes = await readAll();
      const needle = search.toLowerCase();
      const filtered = notes.filter((note) =>
        `${note.title} ${note.body}`.toLowerCase().includes(needle)
      );
      return sort(filtered);
    },
    async create(input) {
      const notes = await readAll();
      const note = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        body: input.body.trim(),
        pinned: false,
        updatedAt: new Date().toISOString()
      };
      notes.push(note);
      await writeAll(notes);
      return note;
    },
    async update(id, input) {
      const notes = await readAll();
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return null;
      notes[index] = {
        ...notes[index],
        title: input.title.trim(),
        body: input.body.trim(),
        updatedAt: new Date().toISOString()
      };
      await writeAll(notes);
      return notes[index];
    },
    async togglePin(id) {
      const notes = await readAll();
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return null;
      notes[index] = { ...notes[index], pinned: !notes[index].pinned };
      await writeAll(notes);
      return notes[index];
    },
    async remove(id) {
      const notes = await readAll();
      const next = notes.filter((note) => note.id !== id);
      if (next.length === notes.length) return false;
      await writeAll(next);
      return true;
    }
  };
}
