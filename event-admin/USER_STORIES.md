# Event Admin - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4105**). Data
> is the in-memory `events` array (fields: `id, name, location, date, capacity,
> registered, status` where status  `Open/Waitlist/Closed`). `validateEvent`/
> `normalizeEvent` guard input (`registered <= capacity`). React client in
> `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Register / cancel with auto-waitlist
**As an** organizer, **I want** one-click register/cancel, **so that** counts and status stay correct.

### Acceptance criteria
- [ ] `PATCH /api/events/:id/register` increments `registered`; at capacity it sets `status = "Waitlist"` instead of erroring.
- [ ] `PATCH /api/events/:id/cancel` decrements (min 0); if it drops below capacity and status was Waitlist, set back to Open.
- [ ] The client has register/cancel buttons.

### Implementation plan
1. **`server/server.js`** - add `register` route: find event (404 if missing); if `registered < capacity` then `registered++`; else set `status = "Waitlist"`. Return the event.
2. **`server/server.js`** - add `cancel` route: `registered = Math.max(0, registered-1)`; if `registered < capacity && status === "Waitlist"` set `status = "Open"`.
3. **`client/src/api.js`** - add `register(id)` / `cancel(id)`.
4. **`client/src/App.jsx`** - add the buttons and refresh after each call.

### How to test
Register up to capacity (status flips to Waitlist), register once more (stays Waitlist), cancel one (back to Open).

---

## Story 2: Attendees as a sub-resource
**As an** organizer, **I want** an attendee list, **so that** `registered` reflects real names.

### Acceptance criteria
- [ ] `GET/POST/DELETE /api/events/:id/attendees` manage attendees `{ id, eventId, name }`.
- [ ] Adding/removing keeps `registered` in sync and respects capacity (waitlist when full).
- [ ] Deleting an event removes its attendees.

### Implementation plan
1. **`server/server.js`** - add an `attendees = []` array. `addAttendee` reuses the register logic for capacity/status. `removeAttendee` reuses cancel logic. Sync `registered` to the per-event count.
2. **`server/server.js`** - nested routes + cascade delete in the event `DELETE`.
3. **`client/src/api.js`** + **`App.jsx`** - expandable attendee list with add/remove.

### How to test
Add three attendees to a capacity-2 event: two register, the third pushes status to Waitlist; remove one and confirm status/Count recover.

---

## Story 3: Conflict detection by date and location
**As an** organizer, **I want** to be warned of clashes, **so that** I don't double-book a venue.

### Acceptance criteria
- [ ] Creating/updating an event that shares the same `date` **and** `location` as another returns a 409 (or a warning flag).
- [ ] The client surfaces the conflict message.

### Implementation plan
1. **`server/server.js`** - add a `findConflict(candidate, ignoreId)` helper that scans `events` for the same `date` + case-insensitive `location` (excluding `ignoreId`). Call it in the `POST` and `PUT` handlers (after `validateEvent`); on a hit, return `409 { error: "Another event is booked at that location and date." }`.
2. **`client/src/App.jsx`** - the existing error handling in `handleSubmit` already shows `error.message`.

### How to test
Create two events at the same place/date -> second returns 409; change the date -> it saves.

---

## Story 4: Dashboard summary route
**As an** organizer, **I want** an at-a-glance summary, **so that** I can see totals.

### Acceptance criteria
- [ ] `GET /api/events/summary` returns total events, total registered, total capacity, and count per status.
- [ ] The client shows summary cards that refresh after changes.

### Implementation plan
1. **`server/server.js`** - add the `summary` route computing the totals with `reduce`. Declare it **before** any `/api/events/:id` route to avoid `:id` capturing `summary`.
2. **`client/src/api.js`** - add `getSummary()`.
3. **`client/src/App.jsx`** - fetch alongside the list and render cards.

### How to test
Register attendees and change statuses, confirm the summary numbers match the list.

---

## Story 5: Sort by date and filter to upcoming
**As an** organizer, **I want** to see upcoming events first, **so that** I plan ahead.

### Acceptance criteria
- [ ] A "Sort" control offers Date (soonest first) and Name (A-Z).
- [ ] An "Upcoming only" filter hides events whose `date` is in the past.

### Implementation plan
1. **`server/server.js`** - in `GET /api/events`, read `sort = "date"` and `upcoming` (string "true"). After filtering, drop past events when `upcoming === "true"` (compare `new Date(event.date)` to today), then sort by date or name.
2. **`client/src/App.jsx`** - add `sort` and an "Upcoming only" checkbox to `filters`.

### How to test
Add past and future events, enable "Upcoming only", confirm past ones disappear and the rest are date-ordered.

