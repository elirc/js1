import * as fs from "node:fs/promises";
import { dirname } from "node:path";

// The repository reads and writes a JSON file on disk. Every mutation
// rewrites the whole file, so data survives a server restart.
export async function createNoteRepository(file, io = fs) {
  let tail = Promise.resolve();
  function serial(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  async function readAll() {
    try {
      const raw = await io.readFile(file, "utf8");
      const notes = JSON.parse(raw);
      if (!Array.isArray(notes)) throw new Error("The notes file must contain an array.");
      return notes;
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
    await io.mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      await io.writeFile(temporary, JSON.stringify(notes, null, 2), { flag: "wx" });
      await io.rename(temporary, file);
    } finally {
      await io.unlink(temporary).catch(() => {});
    }
  }

  function sort(notes) {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  await serial(readAll);
  const methods = {
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
  return Object.fromEntries(Object.entries(methods).map(([name, operation]) => [name, (...args) => serial(() => operation(...args))]));
}
