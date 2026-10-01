import { pathToFileURL } from "node:url";
import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createListenerClient, query } from "./db.js";
import type {
  ChatMessage,
  ClientEvent,
  Room,
  ServerEvent,
} from "../../shared/types.js";

export const app = express();
const port = Number(process.env.PORT ?? 4115);

app.use(cors());
app.use(express.json());

// --- REST: rooms + message history -----------------------------------------

app.get(
  "/api/rooms",
  asyncRoute(async (_req, res) => {
    res.json(
      await query<Room>("SELECT id, slug, name FROM rooms ORDER BY name"),
    );
  }),
);

app.post(
  "/api/rooms",
  asyncRoute(async (req, res) => {
    const slug =
      typeof req.body?.slug === "string"
        ? req.body.slug.trim().toLowerCase()
        : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 80 ||
      !name ||
      name.length > 100
    )
      return res.status(400).json({ error: "Slug and name are required." });
    try {
      const [room] = await query<Room>(
        "INSERT INTO rooms (slug, name) VALUES ($1, $2) RETURNING id, slug, name",
        [slug, name],
      );
      res.status(201).json(room);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "That slug already exists." });
      }
      throw error;
    }
  }),
);

app.get(
  "/api/rooms/:slug/messages",
  asyncRoute(async (req, res) => {
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
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 50`,
      [req.params.slug],
    );
    const history: ChatMessage[] = rows
      .map((row) => ({
        id: row.id,
        roomId: row.room_id,
        author: row.author,
        body: row.body,
        createdAt: row.created_at,
      }))
      .reverse();
    res.json(history);
  }),
);

// --- WebSockets -------------------------------------------------------------

export const server = createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 16384 });

// roomId -> set of sockets currently watching that room.
const roomClients = new Map<string, Set<WebSocket>>();
// Remember each socket's room so we can clean up on disconnect.
const socketRoom = new WeakMap<WebSocket, string>();

wss.on("connection", (socket, req) => {
  void connectSocket(socket, req).catch((error) => {
    console.error(error);
    socket.close(1011, "Database unavailable");
  });
});
async function connectSocket(
  socket: WebSocket,
  req: import("node:http").IncomingMessage,
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const slug = url.searchParams.get("room") ?? "";
  const [room] = await query<Room>(
    "SELECT id, slug, name FROM rooms WHERE slug = $1",
    [slug],
  );
  if (!room) {
    socket.close(4404, "Unknown room");
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) return;
  join(room.id, socket);

  socket.on("message", async (data) => {
    let event: ClientEvent;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (
      !event ||
      typeof event !== "object" ||
      event.type !== "message" ||
      typeof event.author !== "string" ||
      typeof event.body !== "string"
    )
      return;
    if (event.author.length > 40 || event.body.length > 2000) return;

    const author = event.author.trim().slice(0, 40) || "anonymous";
    const body = event.body.trim().slice(0, 2000);
    if (!body) return;

    // Just insert. The trigger + LISTEN loop are what actually deliver this
    // message to every connected client (including the sender).
    try {
      await query(
        "INSERT INTO messages (room_id, author, body) VALUES ($1, $2, $3)",
        [room.id, author, body],
      );
    } catch (error) {
      console.error(error);
      socket.close(1011, "Message could not be saved");
    }
  });

  socket.on("close", () => leave(socket));
  socket.on("error", () => leave(socket));
}

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
  broadcast(roomId, {
    type: "presence",
    count: roomClients.get(roomId)?.size ?? 0,
  });
}

// --- Postgres LISTEN loop ---------------------------------------------------

let listener: ReturnType<typeof createListenerClient> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
async function startListener() {
  const client = createListenerClient();
  listener = client;
  client.on("error", (error) => {
    console.error("Listener error:", error.message);
    void client.end().catch(() => {});
    if (!stopping && !retry)
      retry = setTimeout(() => {
        retry = undefined;
        void startListener().catch(console.error);
      }, 1000);
  });
  await client.connect();
  await client.query("LISTEN chat");
  client.on("notification", (msg) => {
    if (!msg.payload) return;
    try {
      const message = JSON.parse(msg.payload) as ChatMessage;
      if (message.roomId)
        broadcast(message.roomId, { type: "message", message });
    } catch {
      /* Ignore malformed notifications from other demos. */
    }
  });
}
export async function startRuntime(listenPort = port) {
  stopping = false;
  await startListener();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}
export async function stopRuntime() {
  stopping = true;
  if (retry) clearTimeout(retry);
  retry = undefined;
  for (const socket of wss.clients) socket.terminate();
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  await listener?.end().catch(() => {});
  roomClients.clear();
}
function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<unknown>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res.status(500).json({ error: "Request failed." });
  },
);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  startRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
