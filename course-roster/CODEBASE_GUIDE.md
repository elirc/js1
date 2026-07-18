# Course Roster Codebase Guide

This project teaches CRUD with business constraints. Corporate apps often care less about fancy UI and more about enforcing rules like "enrollment cannot exceed capacity."

## Code Map

- `server/server.js`: course routes and business validation.
- `client/src/api.js`: typed-by-convention API functions.
- `client/src/App.jsx`: controlled form, filters, derived open seats.
- `client/src/styles.css`: roster layout.

## Business Rule Validation

```js
if (course.enrolled > course.capacity) {
  return res.status(400).json({ error: "Enrollment cannot exceed capacity." });
}
```

This is the most important line in the backend. In real systems, business rules belong server-side because the database and API must stay valid no matter what client sends data.

## Normalization

```js
function normalizeCourse(input) {
  return {
    code: String(input.code || "").trim().toUpperCase(),
    title: String(input.title || "").trim(),
    capacity: Number(input.capacity),
    enrolled: Number(input.enrolled)
  };
}
```

Normalize input before validating or storing. This creates predictable data. Production apps often use schema libraries for this, but the idea is the same.

## Derived Seats in React

```js
const totalSeats = useMemo(() => {
  return courses.reduce((sum, course) => sum + course.capacity - course.enrolled, 0);
}, [courses]);
```

`useMemo` documents that this value is derived from `courses`. It is not required for performance here, but it teaches a pattern that matters as calculations grow.

## Client Request Wrapper

```js
async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
}
```

This wrapper makes error handling consistent. In larger apps, this is where auth headers, tracing IDs, retry behavior, and JSON parsing live.

## Extension Practice

- Add students as a second resource.
- Add `POST /api/courses/:id/enroll`.
- Prevent deleting a course with enrolled students.
- Add server-side sorting by `code`.
- Move validation into its own module.

Practice reading from the business rule outward: what UI, API, data model, and validation changes are needed?
