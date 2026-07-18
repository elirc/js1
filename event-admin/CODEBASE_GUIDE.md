# Event Admin Codebase Guide

This app teaches CRUD plus capacity management. Event systems, booking tools, and resource schedulers all use similar rules.

## Code Map

- `server/server.js`: event routes, status validation, capacity validation.
- `client/src/api.js`: fetch helpers.
- `client/src/App.jsx`: form state, filters, available-seat summary.
- `client/src/styles.css`: event cards and layout.

## Capacity Business Rule

```js
if (event.capacity < 1 || event.registered < 0 || event.registered > event.capacity) {
  return res.status(400).json({ error: "Capacity and registered counts are invalid." });
}
```

This is the codebase's core invariant. An invariant is something that should always be true if the system is healthy.

## Data Normalization

```js
function normalizeEvent(input) {
  return {
    name: String(input.name || "").trim(),
    location: String(input.location || "").trim(),
    capacity: Number(input.capacity),
    registered: Number(input.registered)
  };
}
```

Normalize before storage so downstream code can trust field types.

## Derived UI Summary

```js
const totalOpenSeats = useMemo(() => {
  return events.reduce((sum, event) => sum + event.capacity - event.registered, 0);
}, [events]);
```

This is a read model: one useful value derived from a list. In bigger systems, read models may be cached, indexed, or materialized.

## Filter Contract

```js
export const listEvents = (filters) => request(`${API_URL}?${new URLSearchParams(filters)}`);
```

The client sends filter state as query parameters. This mirrors production URLs and makes list views bookmarkable if you later sync filters to the browser address bar.

## Extension Practice

- Add attendee records.
- Add waitlist behavior.
- Add date sorting.
- Add `PATCH /api/events/:id/status`.
- Prevent deleting closed events.

For every new rule, decide whether it belongs in the UI only or must be enforced by the server.
