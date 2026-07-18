# Live Chat - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express + `ws` on port **4115**. A Postgres
> `AFTER INSERT` trigger calls `pg_notify('chat', ...)`; a dedicated `LISTEN`
> client in `server/src/index.ts` rebroadcasts to room sockets (`roomClients`
> map). Presence is broadcast on join/leave. History loads over REST. Protocol
> types live in `shared/types.ts` (`ServerEvent`/`ClientEvent`); the client is in
> `client/src/App.tsx` with the socket lifecycle in a `useEffect`.

---

## Story 1: Typing indicators
**As a** user, **I want** to see who's typing, **so that** conversation feels live.

### Acceptance criteria
- [ ] While a user types, others in the room see "X is typing..."; it clears after ~2s of inactivity.
- [ ] Typing events are transient (never persisted to Postgres).

### Implementation plan
1. **`shared/types.ts`** - extend `ClientEvent` with `{ type: "typing"; author: string }` and `ServerEvent` with `{ type: "typing"; author: string }`.
2. **`server/src/index.ts`** - in the socket `message` handler, when `event.type === "typing"`, `broadcast(room.id, { type:"typing", author })` directly (do **not** touch the DB).
3. **`client/src/App.tsx`** - on input change, throttle-send a `typing` event; track incoming typers in state with a per-author timeout that clears after 2s; render the indicator above the composer.

### How to test
Open two tabs in the same room; typing in one shows "... is typing" in the other and clears shortly after you stop.

---

## Story 2: Edit and delete messages
**As a** user, **I want** to fix or remove a message, **so that** mistakes don't linger.

### Acceptance criteria
- [ ] Authors can edit/delete their own messages; changes propagate live to all clients.
- [ ] Edited messages show an "(edited)" marker; deleted ones show "message deleted".

### Implementation plan
1. **`server/db/schema.sql`** - add `edited_at timestamptz` and `deleted boolean DEFAULT false` to `messages`. Add `AFTER UPDATE` triggers that `pg_notify` on channels `chat_update`/`chat_delete` (or reuse `chat` with a `kind` field in the payload).
2. **`server/src/index.ts`** - add REST `PUT /api/messages/:id` and `DELETE /api/messages/:id`. Extend the LISTEN handler (or add listeners) to broadcast `{ type:"update"|"delete", message }`.
3. **`shared/types.ts`** - add `update`/`delete` to `ServerEvent`.
4. **`client/src/App.tsx`** - handle those events by replacing/marking the message in state; add edit/delete controls on own bubbles.

### How to test
Edit a message in one tab, confirm the other updates with "(edited)"; delete it and confirm both show "message deleted".

---

## Story 3: Unread counts per room
**As a** user, **I want** unread badges, **so that** I know where new messages arrived.

### Acceptance criteria
- [ ] Each room in the sidebar shows an unread count for rooms you're not currently viewing.
- [ ] Switching to a room clears its badge.

### Implementation plan
1. **`client/src/App.tsx`** - open a lightweight socket per room is overkill; instead, on initial load fetch each room's latest message timestamp and store a per-room "lastSeen" in `localStorage`.
2. **`client/src/App.tsx`** - keep the active room's socket as-is; for unread counts, poll `GET /api/rooms/:slug/messages` periodically (or add a server `unread` summary route) and compare newest `createdAt` to `lastSeen[slug]`.
3. On entering a room, set `lastSeen[slug] = now()` and clear its badge.

### How to test
Be in room A while a second tab posts to room B; confirm B shows an unread badge that clears when you open B.

---

## Story 4: Message reactions
**As a** user, **I want** emoji reactions, **so that** I can respond quickly.

### Acceptance criteria
- [ ] Users can react to a message with an emoji (e.g. thumbs-up / heart / laugh); counts show on the bubble.
- [ ] Reactions persist and broadcast live.

### Implementation plan
1. **`server/db/schema.sql`** - add a `reactions` table `{ message_id, emoji, author, PRIMARY KEY(message_id, emoji, author) }` with `ON DELETE CASCADE`, and a trigger to `pg_notify('chat_reaction', ...)`.
2. **`server/src/index.ts`** - add `POST /api/messages/:id/reactions` (toggle add/remove via `ON CONFLICT`), a LISTEN handler that broadcasts `{ type:"reaction", messageId, counts }`.
3. **`shared/types.ts`** + **`client/src/App.tsx`** - add the event type, a reaction picker on each bubble, and aggregate counts in state.

### How to test
React in one tab, confirm the count appears in both; react again to toggle it off.

---

## Story 5: Username persistence and simple sign-in
**As a** user, **I want** my name remembered, **so that** I don't retype it.

### Acceptance criteria
- [ ] The chosen username persists across reloads.
- [ ] A name is required before sending; the WebSocket connection includes it.

### Implementation plan
1. **`client/src/App.tsx`** - initialize `author` from `localStorage` (`js1-chat-name`) and write it on change; gate the composer until a name is set.
2. **`server/src/index.ts`** - optionally accept the name as a query param on the socket URL and store it on the socket for presence labeling.
3. (Optional) extend presence to broadcast the list of names, not just a count - add `names: string[]` to the presence `ServerEvent` and render who's online.

### How to test
Set a name, reload, confirm it's prefilled; clear it and confirm sending is blocked until re-entered.

