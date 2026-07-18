import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createListenerClient, query } from "./db.js";
import type { ChatMessage, ClientEvent, Room, ServerEvent } from "../../shared/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4115);

app.use(cors());
app.use(express.json());

// --- REST: rooms + message history -----------------------------------------

app.get("/api/rooms", async (_req, res) => {
  res.json(await query<Room>("SELECT id, slug, name FROM rooms ORDER BY name"));
});

app.post("/api/rooms", async (req, res) => {
  const slug = String(req.body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = String(req.body.name ?? "").trim();
  if (!slug || !name) return res.status(400).json({ error: "Slug and name are required." });
  try {
    const [room] = await query<Room>(
      "INSERT INTO rooms (slug, name) VALUES ($1, $2) RETURNING id, slug, name",
      [slug, name]
    );
    res.status(201).json(room);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "That slug already exists." });
    }
    throw error;
  }
});

app.get("/api/rooms/:slug/messages", async (req, res) => {
  const rows = await query<{
    id: string;
    room_id: string;
    author: string;
    body: string;
    created_at: string;
  }>(
    `SELECT m.id, m.room_id, m.author, m.body, m.created_at
       FROM messages m JOIN rooms r ON r.id = m.room_id
      WHERE r.slug = $1
      ORDER BY m.created_at DESC
      LIMIT 50`,
    [req.params.slug]
  );
  const history: ChatMessage[] = rows
    .map((row) => ({
      id: row.id,
      roomId: row.room_id,
      author: row.author,
      body: row.body,
      createdAt: row.created_at
    }))
    .reverse();
  res.json(history);
});

// --- WebSockets -------------------------------------------------------------

const server = createServer(app);
const wss = new WebSocketServer({ server });

// roomId -> set of sockets currently watching that room.
const roomClients = new Map<string, Set<WebSocket>>();
// Remember each socket's room so we can clean up on disconnect.
const socketRoom = new WeakMap<WebSocket, string>();

wss.on("connection", async (socket, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const slug = url.searchParams.get("room") ?? "";
  const [room] = await query<Room>("SELECT id, slug, name FROM rooms WHERE slug = $1", [slug]);
  if (!room) {
    socket.close(4404, "Unknown room");
    return;
  }

  join(room.id, socket);

  socket.on("message", async (data) => {
    let event: ClientEvent;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (event.type !== "message") return;

    const author = event.author.trim().slice(0, 40) || "anonymous";
    const body = event.body.trim().slice(0, 2000);
    if (!body) return;

    // Just insert. The trigger + LISTEN loop are what actually deliver this
    // message to every connected client (including the sender).
    await query("INSERT INTO messages (room_id, author, body) VALUES ($1, $2, $3)", [
      room.id,
      author,
      body
    ]);
  });

  socket.on("close", () => leave(socket));
  socket.on("error", () => leave(socket));
});

function join(roomId: string, socket: WebSocket) {
  socketRoom.set(socket, roomId);
  const set = roomClients.get(roomId) ?? new Set<WebSocket>();
  set.add(socket);
  roomClients.set(roomId, set);
  broadcastPresence(roomId);
}

function leave(socket: WebSocket) {
  const roomId = socketRoom.get(socket);
  if (!roomId) return;
  socketRoom.delete(socket);
  const set = roomClients.get(roomId);
  if (set) {
    set.delete(socket);
    broadcastPresence(roomId);
  }
}

function broadcast(roomId: string, event: ServerEvent) {
  const set = roomClients.get(roomId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const socket of set) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

function broadcastPresence(roomId: string) {
  broadcast(roomId, { type: "presence", count: roomClients.get(roomId)?.size ?? 0 });
}

// --- Postgres LISTEN loop ---------------------------------------------------

async function startListener() {
  const client = createListenerClient();
  await client.connect();
  await client.query("LISTEN chat");
  client.on("notification", (msg) => {
    if (!msg.payload) return;
    const message = JSON.parse(msg.payload) as ChatMessage;
    broadcast(message.roomId, { type: "message", message });
  });
  // If the listener connection drops, retry so the app self-heals.
  client.on("error", (error) => {
    console.error("Listener error, reconnecting in 1s:", error.message);
    setTimeout(startListener, 1000);
  });
  console.log("Listening on Postgres channel 'chat'");
}

server.listen(port, () => {
  console.log(`Live Chat API + WebSocket on http://localhost:${port}`);
});

startListener().catch((error) => {
  console.error("Failed to start Postgres listener:", error);
  process.exit(1);
});
