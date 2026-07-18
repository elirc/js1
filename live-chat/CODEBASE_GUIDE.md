# Live Chat Codebase Guide

Live Chat introduces real-time systems. The important lesson is that HTTP request/response is not the only communication model in web apps.

## Code Map

- `shared/types.ts`: room, message, presence, and API/event contracts.
- `server/src/index.ts`: Express routes plus WebSocket server.
- `server/src/db.ts`: Postgres pool and LISTEN/NOTIFY helper logic.
- `server/db/schema.sql`: rooms, messages, triggers.
- `client/src/api.ts`: REST calls.
- `client/src/App.tsx`: room selection, message list, socket events.

## WebSocket Server

```ts
const wss = new WebSocketServer({ server });
```

The WebSocket server attaches to the same HTTP server as Express. This is common in Node apps that serve both REST and live updates.

## Postgres Notify Pattern

```sql
PERFORM pg_notify('chat', row_to_json(NEW)::text);
```

Database triggers can publish events when rows are inserted. This helps multiple server processes hear about new messages, not just the process that handled the original request.

## Presence State

Presence is not persisted like messages. It is runtime state derived from connected sockets:

```ts
const roomSockets = new Map<string, Set<WebSocket>>();
```

Production systems often separate durable data from ephemeral presence data.

## Client Event Handling

```tsx
socket.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  setMessages((current) => [...current, payload.message]);
};
```

Use functional state updates when new state depends on previous state. This avoids stale closure bugs.

## Extension Practice

- Add typing indicators.
- Add message editing.
- Add reconnection behavior.
- Add unread counts.
- Add rate limiting to message creation.

Real-time code is lifecycle-heavy. Always ask: who opens the connection, who closes it, and what happens after reconnect?
