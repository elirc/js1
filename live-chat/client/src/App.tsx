import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Room, ServerEvent } from "../../shared/types";
import { createRoom, listMessages, listRooms, WS_URL } from "./api";

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState(0);
  const [connected, setConnected] = useState(false);
  const [author, setAuthor] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [draft, setDraft] = useState("");
  const [newRoom, setNewRoom] = useState({ slug: "", name: "" });
  const [message, setMessage] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRooms().then((data) => {
      setRooms(data);
      if (data[0]) setActiveSlug(data[0].slug);
    }).catch((error) => setMessage((error as Error).message));
  }, []);

  // Open (and re-open) the socket whenever the active room changes.
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;

    listMessages(activeSlug)
      .then((history) => !cancelled && setMessages(history))
      .catch((error) => setMessage((error as Error).message));

    function connect() {
      const socket = new WebSocket(`${WS_URL}/?room=${encodeURIComponent(activeSlug)}`);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        // Reconnect unless this effect was torn down (room change/unmount).
        if (!cancelled) reconnectRef.current = setTimeout(connect, 1000);
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as ServerEvent;
        if (data.type === "message") {
          setMessages((current) => [...current, data.message]);
        } else if (data.type === "presence") {
          setPresence(data.count);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [activeSlug]);

  // Autoscroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    const socket = socketRef.current;
    if (!body || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "message", author, body }));
    setDraft("");
  }

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    try {
      const room = await createRoom(newRoom);
      setRooms((current) => [...current, room].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoom({ slug: "", name: "" });
      setActiveSlug(room.slug);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  const activeRoom = rooms.find((room) => room.slug === activeSlug) ?? null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <p className="eyebrow">TS · React · Node · Postgres — Project 6</p>
        <h1>Live Chat</h1>
        <p className="muted small">WebSockets + Postgres LISTEN/NOTIFY</p>

        <h2>Rooms</h2>
        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                className={room.slug === activeSlug ? "active" : ""}
                onClick={() => setActiveSlug(room.slug)}
              >
                #{room.slug}
              </button>
            </li>
          ))}
        </ul>

        <form className="new-room" onSubmit={handleCreateRoom}>
          <input placeholder="slug" value={newRoom.slug} onChange={(e) => setNewRoom({ ...newRoom, slug: e.target.value })} />
          <input placeholder="Display name" value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} />
          <button type="submit" className="secondary">Add room</button>
        </form>

        <label className="name-field">Your name</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        <p className="message">{message}</p>
      </aside>

      <section className="chat">
        <header className="chat-header">
          <h2>{activeRoom ? activeRoom.name : "Select a room"}</h2>
          <div className="status">
            <span className={`dot ${connected ? "on" : "off"}`} />
            {connected ? "connected" : "reconnecting…"} · {presence} online
          </div>
        </header>

        <div className="messages">
          {messages.map((m) => (
            <div className={`bubble ${m.author === author ? "mine" : ""}`} key={m.id}>
              <span className="author">{m.author}</span>
              <span className="body">{m.body}</span>
              <time className="muted small">{new Date(m.createdAt).toLocaleTimeString()}</time>
            </div>
          ))}
          {messages.length === 0 && <p className="muted">No messages yet — say hello.</p>}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <input
            placeholder={`Message #${activeSlug}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={!connected}>Send</button>
        </form>
      </section>
    </main>
  );
}
