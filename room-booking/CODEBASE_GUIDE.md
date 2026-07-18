# Room Booking Codebase Guide

Room Booking teaches database-enforced business rules. The core rule is simple: two bookings for the same room cannot overlap.

## Code Map

- `shared/types.ts`: room, booking, new booking contracts.
- `server/src/db.ts`: Postgres helper.
- `server/src/index.ts`: room and booking routes.
- `server/db/schema.sql`: range constraints and indexes.
- `client/src/api.ts`: API calls.
- `client/src/App.tsx`: booking form, room filters, booking list.

## Database Constraint

```sql
EXCLUDE USING gist (
  room_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
)
```

This is stronger than checking overlap in JavaScript. The database rejects conflicting bookings even under concurrent requests.

## Time Range Validation

```sql
CHECK (ends_at > starts_at)
```

Put obvious invariants in the database. API validation improves errors; database constraints protect truth.

## Mapping Database Errors

```ts
if (isOverlapError(error)) {
  return res.status(409).json({ error: "Room is already booked for that time." });
}
```

HTTP `409 Conflict` communicates a business conflict. Good APIs use status codes intentionally.

## Frontend Date Helpers

```ts
const today = () => new Date().toISOString().slice(0, 10);
```

Date helpers should be named and centralized. Booking apps are especially sensitive to time zones.

## Extension Practice

- Add editing bookings.
- Add recurring bookings.
- Add timezone display.
- Add booking owner.
- Add tests for overlapping edge cases.

Scheduling systems should rely on database guarantees, not "hope no two users click at once."
