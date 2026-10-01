import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import {
  randomUUID,
  scryptSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const app = express();
const port = 4108;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (
    ["POST", "PUT", "PATCH"].includes(req.method) &&
    (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
  )
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

const users = new Map(); // email -> { id, email, passwordHash, salt }
const tokens = new Map(); // token -> { userId, expiresAt }
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function sessionTtlMs() {
  const configured = Number(process.env.SESSION_TTL_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_SESSION_TTL_MS;
}
const notes = []; // { id, userId, title, body, createdAt }

// --- Auth routes -----------------------------------------------------------

app.post("/api/auth/register", (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body.password;
  if (!isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 128
  ) {
    return res
      .status(400)
      .json({ error: "Password must contain 6–128 characters." });
  }
  if (users.has(email.toLowerCase())) {
    return res.status(409).json({ error: "That email is already registered." });
  }

  const salt = randomBytes(16).toString("hex");
  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    salt,
    passwordHash: hashPassword(password, salt),
  };
  users.set(user.email, user);

  res.status(201).json(issueSession(user));
});

app.post("/api/auth/login", (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body.password;
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

app.get("/api/notes/:id", requireAuth, (req, res) => {
  const note = findOwnedNote(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "Note not found." });
  res.json(note);
});

app.post("/api/notes", requireAuth, validateNote, (req, res) => {
  const note = {
    id: randomUUID(),
    userId: req.user.id,
    title: req.body.title.trim(),
    body: (req.body.body || "").trim(),
    createdAt: new Date().toISOString(),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  app.listen(port, () => {
    console.log(`Secure Notes API listening on http://localhost:${port}`);
  });

// --- Middleware & helpers --------------------------------------------------

// Reads "Authorization: Bearer <token>", looks up the session, and attaches
// the user to the request. Any protected route lists this before its handler.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? tokens.get(token) : undefined;
  if (!session) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  if (session.expiresAt <= Date.now()) {
    // Expiry belongs to the session store: the note routes never see an expired caller.
    tokens.delete(token);
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
  const userId = session.userId;
  const user = [...users.values()].find((candidate) => candidate.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Session is no longer valid." });
  }
  req.token = token;
  req.user = user;
  next();
}

function validateNote(req, res, next) {
  if (
    req.body.body !== undefined &&
    (typeof req.body.body !== "string" || req.body.body.length > 20000)
  )
    return res
      .status(400)
      .json({ error: "Body must be text of at most 20,000 characters." });
  if (
    typeof req.body.title !== "string" ||
    req.body.title.trim().length < 2 ||
    req.body.title.trim().length > 200
  ) {
    return res
      .status(400)
      .json({ error: "Title must contain 2–200 characters." });
  }
  next();
}

function issueSession(user) {
  const token = randomUUID();
  const expiresAt = Date.now() + sessionTtlMs();
  tokens.set(token, { userId: user.id, expiresAt });
  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: { id: user.id, email: user.email },
  };
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
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 128
  )
    return false;
  const attempt = Buffer.from(hashPassword(password, user.salt), "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  return attempt.length === stored.length && timingSafeEqual(attempt, stored);
}

function isEmail(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
  );
}
