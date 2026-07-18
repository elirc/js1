import express from "express";
import cors from "cors";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const app = express();
const port = 4108;

app.use(cors());
app.use(express.json());

const users = new Map(); // email -> { id, email, passwordHash, salt }
const tokens = new Map(); // token -> userId
const notes = []; // { id, userId, title, body, createdAt }

// --- Auth routes -----------------------------------------------------------

app.post("/api/auth/register", (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (users.has(email.toLowerCase())) {
    return res.status(409).json({ error: "That email is already registered." });
  }

  const salt = randomBytes(16).toString("hex");
  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    salt,
    passwordHash: hashPassword(password, salt)
  };
  users.set(user.email, user);

  res.status(201).json(issueSession(user));
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.get((email || "").toLowerCase());
  if (!user || !verifyPassword(password, user)) {
    // Same message for both cases so we don't reveal which emails exist.
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json(issueSession(user));
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  tokens.delete(req.token);
  res.status(204).send();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

// --- Notes (protected, scoped to the logged-in user) -----------------------

app.get("/api/notes", requireAuth, (req, res) => {
  res.json(notesFor(req.user.id));
});

app.post("/api/notes", requireAuth, validateNote, (req, res) => {
  const note = {
    id: randomUUID(),
    userId: req.user.id,
    title: req.body.title.trim(),
    body: (req.body.body || "").trim(),
    createdAt: new Date().toISOString()
  };
  notes.unshift(note);
  res.status(201).json(note);
});

app.put("/api/notes/:id", requireAuth, validateNote, (req, res) => {
  const note = findOwnedNote(req.params.id, req.user.id);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  note.title = req.body.title.trim();
  note.body = (req.body.body || "").trim();
  res.json(note);
});

app.delete("/api/notes/:id", requireAuth, (req, res) => {
  const note = findOwnedNote(req.params.id, req.user.id);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }
  const index = notes.indexOf(note);
  notes.splice(index, 1);
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Secure Notes API listening on http://localhost:${port}`);
});

// --- Middleware & helpers --------------------------------------------------

// Reads "Authorization: Bearer <token>", looks up the session, and attaches
// the user to the request. Any protected route lists this before its handler.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const userId = token && tokens.get(token);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  const user = [...users.values()].find((candidate) => candidate.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Session is no longer valid." });
  }
  req.token = token;
  req.user = user;
  next();
}

function validateNote(req, res, next) {
  if (!req.body.title || req.body.title.trim().length < 2) {
    return res.status(400).json({ error: "Title must be at least 2 characters." });
  }
  next();
}

function issueSession(user) {
  const token = randomUUID();
  tokens.set(token, user.id);
  return { token, user: { id: user.id, email: user.email } };
}

function notesFor(userId) {
  return notes.filter((note) => note.userId === userId);
}

function findOwnedNote(id, userId) {
  return notes.find((note) => note.id === id && note.userId === userId);
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  if (!password) return false;
  const attempt = Buffer.from(hashPassword(password, user.salt), "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  return attempt.length === stored.length && timingSafeEqual(attempt, stored);
}

function isEmail(value) {
  return typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
