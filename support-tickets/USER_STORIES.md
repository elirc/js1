# Support Tickets - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** TS + Express on port **4111**. Tables: `agents`,
> `tickets`, `labels`, `ticket_labels` (M:N), `ticket_events` (audit log).
> `server/src/index.ts` aggregates labels with `json_agg(...) FILTER`, filters by
> a joined label via `EXISTS`, and writes ticket + labels + an event inside
> `withTransaction`. `shared/types.ts` shared with `client/src/App.tsx`/`api.ts`.

---

## Story 1: Label CRUD with usage counts
**As an** admin, **I want** to manage labels, **so that** the taxonomy stays clean.

### Acceptance criteria
- [ ] `POST /api/labels`, `PUT /api/labels/:id`, `DELETE /api/labels/:id` exist.
- [ ] `GET /api/labels` includes a `count` of tickets using each label.
- [ ] Deleting a label removes it from tickets (the join row cascades).

### Implementation plan
1. **`server/src/index.ts`** - extend `GET /api/labels` to `LEFT JOIN ticket_labels` and `COUNT(tl.ticket_id) AS count GROUP BY l.id`. Add create/update/delete routes (the join table already has `ON DELETE CASCADE`).
2. **`shared/types.ts`** - add `count: number` to `Label`.
3. **`client/src/App.tsx`** - add a small "Manage labels" panel listing labels with counts and add/rename/delete controls; reload labels after changes.

### How to test
Create a label, attach it to tickets, confirm the count; delete it and confirm it vanishes from tickets and the picker.

---

## Story 2: "Assign to me" and assignee filter UI
**As an** agent, **I want** to grab tickets, **so that** ownership is clear.

### Acceptance criteria
- [ ] An "Assign to me" button on a ticket sets the assignee (records an `assignment` event) via the existing `PATCH .../assignee`.
- [ ] An assignee filter (the API already accepts `assignee`) is exposed in the toolbar.

### Implementation plan
1. **`client/src/App.tsx`** - add a current-agent selector (pick "me" from the agents list, stored in component state). "Assign to me" calls `setAssignee(ticket.id, meId)` then refreshes.
2. **`client/src/App.tsx`** - add an assignee `<select>` to the filters; `listTickets` already serializes `assignee`.
3. No server change - `PATCH /api/tickets/:id/assignee` and the `assignee` filter already exist.

### How to test
Pick an agent as "me", click "Assign to me" on a ticket, confirm the assignee updates and an `assignment` event appears in History; filter by that assignee.

---

## Story 3: SLA due dates and overdue highlighting
**As a** lead, **I want** SLA timers, **so that** I can spot breaches.

### Acceptance criteria
- [ ] Tickets gain a `due_at timestamptz` (set on create from a priority-based default, editable).
- [ ] Open tickets past `due_at` show an "Overdue" tag; a filter shows overdue-only.

### Implementation plan
1. **`server/db/schema.sql`** - add `due_at timestamptz`. Re-run setup.
2. **`server/src/index.ts`** - on create, default `due_at = now() + interval` based on priority (e.g. urgent 4h, high 1d, normal 3d, low 7d) unless provided. Add `dueAt` to `TICKET_SELECT`/`toTicket`. Support an `overdue=true` filter (`due_at < now() AND status NOT IN ('resolved','closed')`).
3. **`shared/types.ts`** - add `dueAt: string | null`.
4. **`client/src/App.tsx`** - show the overdue tag and add the filter.

### How to test
Create an urgent ticket, set `due_at` to the past, confirm "Overdue" and that resolving it clears the flag; filter overdue-only.

---

## Story 4: Free-form comments (distinct from audit events)
**As an** agent, **I want** to add comments, **so that** I can discuss without polluting the audit log.

### Acceptance criteria
- [ ] A `ticket_comments` table stores `{ id, ticket_id, author, body, created_at }`.
- [ ] `GET/POST /api/tickets/:id/comments` work; comments cascade on ticket delete.
- [ ] The client shows comments separately from the History timeline.

### Implementation plan
1. **`server/db/schema.sql`** - add the `ticket_comments` table with `ON DELETE CASCADE`. Re-run setup.
2. **`server/src/index.ts`** - add nested GET/POST routes (validate `author`+`body`).
3. **`shared/types.ts`** - add a `TicketComment` interface; **`client/src/api.ts`** - add the calls.
4. **`client/src/App.tsx`** - add a comments section + input under each ticket, separate from the `History` (events) view.

### How to test
Add comments to a ticket, confirm they show in the comments area (not History); delete the ticket and confirm comments are gone.

---

## Story 5: Saved filter views
**As an** agent, **I want** to save filter combos, **so that** I can switch contexts fast.

### Acceptance criteria
- [ ] I can save the current filters (status/priority/label/assignee/search) under a name.
- [ ] Saved views appear as buttons that re-apply the filters.
- [ ] Views persist in `localStorage`.

### Implementation plan
1. **`client/src/App.tsx`** - add `savedViews` state loaded from `localStorage` (`{ name, filters }[]`). A "Save view" button captures the current `filters`.
2. **`client/src/App.tsx`** - render a button per view that does `setFilters(view.filters)`; add a small delete control. Persist on every change.
3. Pure client feature - no server changes.

### How to test
Set "status=open, priority=urgent", save as "Fires", change filters, click "Fires", confirm the filters reapply; reload and confirm the view persists.

