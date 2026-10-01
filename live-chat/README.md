# Live Chat (TypeScript · React · Node · Postgres)

A real-time chat app. The lesson is **pushing data to clients** with WebSockets,
fanned out through Postgres **LISTEN / NOTIFY** so the system works even with
more than one server process.

## What it teaches

- Attaching a `ws` `WebSocketServer` to the same Node HTTP server as Express
- Tracking connected sockets per room and broadcasting **presence** counts
- A Postgres `AFTER INSERT` trigger that calls `pg_notify('chat', …)`
- A dedicated long-lived `pg.Client` running `LISTEN chat` (a pool can't hold a
  connection open, so this is a separate client) that rebroadcasts to sockets
- A clean data flow: the client only ever *inserts*; delivery to everyone
  (including the sender) happens via the NOTIFY → LISTEN → broadcast path
- Client-side reconnection and autoscroll

## The flow of one message

```
client --ws--> server INSERT ──trigger──> pg_notify('chat', payload)
                                                  │
   browsers <--ws-- server  <--LISTEN 'chat'------┘
```

Because delivery rides on NOTIFY, a message inserted from `psql` or a second
server instance still reaches every browser. Try it: open two tabs.

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb live_chat
npm install
npm run db:setup
npm run dev          # HTTP + WS on :4115, client on :5115
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## Stretch ideas

- Add typing indicators (broadcast a transient `typing` event, not persisted).
- Add "message delivered" acks or edit/delete with more NOTIFY channels.
- `NOTIFY` payloads are capped at ~8 KB — for large data, notify just an id and
  have listeners `SELECT` the row.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): HTTP boundaries, WebSocket messages and database notifications, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
