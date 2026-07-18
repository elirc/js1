# Course Roster - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4102**). Data
> is the in-memory `courses` array (fields: `id, code, title, instructor,
> capacity, enrolled, level`). `validateCourse`/`normalizeCourse` guard input;
> the rule `enrolled <= capacity` is already enforced. React client in
> `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Enroll / drop endpoints
**As a** registrar, **I want** one-click enroll and drop, **so that** I don't hand-edit counts.

### Acceptance criteria
- [ ] `PATCH /api/courses/:id/enroll` increments `enrolled` by 1; blocked (409) when already at capacity.
- [ ] `PATCH /api/courses/:id/drop` decrements `enrolled` by 1; never below 0.
- [ ] The client has "+ Enroll" / "' Drop" buttons that update the card.

### Implementation plan
1. **`server/server.js`** - add `app.patch("/api/courses/:id/enroll", ...)`: find the course (404 if missing); if `enrolled >= capacity` return `409 { error: "Course is full." }`; else `enrolled++`, return the course.
2. **`server/server.js`** - add the matching `drop` route with `enrolled = Math.max(0, enrolled - 1)`.
3. **`client/src/api.js`** - add `enroll(id)` and `drop(id)` (PATCH, no body) using `request()`.
4. **`client/src/App.jsx`** - add buttons calling these then `refreshCourses()`; surface the 409 message via the existing `setMessage`.

### How to test
Enroll until full, confirm the next enroll returns 409 and shows the message; drop and confirm it decrements and never goes negative.

---

## Story 2: Show available seats and a "Full" badge
**As a** user, **I want** to see remaining seats, **so that** I know what's open.

### Acceptance criteria
- [ ] Each card shows `available = capacity - enrolled`.
- [ ] Courses with 0 available show a red "Full" badge.

### Implementation plan
1. **`client/src/App.jsx`** - compute `const available = course.capacity - course.enrolled` in the card render; show `${available} seats left`. (No server change needed - it's derived.)
2. **`client/src/App.jsx`** - when `available <= 0`, render a `<span className="badge full">Full</span>`.
3. **`client/src/styles.css`** - add a `.badge.full` style.

### How to test
A course at capacity shows "0 seats left" and the Full badge; dropping a student reveals "1 seat left" and hides the badge.

---

## Story 3: Filter by level with a waitlist option
**As a** user, **I want** to filter by level, **so that** I can find courses at my level.

### Acceptance criteria
- [ ] The list filters by level server-side (the API already accepts `level`).
- [ ] A `waitlisted` boolean lets a full course still accept enroll requests into a separate count.

### Implementation plan
1. **`client/src/App.jsx`** - add a level `<select>` bound to `filters.level`; the server's `GET /api/courses` already reads `level`, so the existing refetch works.
2. **`server/server.js`** - add `waitlist: 0` in `normalizeCourse` defaults and seed. Modify the `enroll` route (Story 1): when full, increment `waitlist` instead of returning 409 (return the course with the new waitlist count).
3. **`client/src/App.jsx`** - show "Waitlist: N" when `waitlist > 0`.

### How to test
Filter to "Advanced", confirm only those courses; enroll into a full course and confirm the waitlist count rises instead of erroring.

---

## Story 4: Students as a sub-resource
**As a** registrar, **I want** to list enrolled students, **so that** counts reflect real people.

### Acceptance criteria
- [ ] `GET/POST /api/courses/:id/students` manage a per-course student list.
- [ ] Adding a student increments `enrolled` (respecting capacity); removing decrements.
- [ ] The client can expand a course to see/add students.

### Implementation plan
1. **`server/server.js`** - add a `students = []` array of `{ id, courseId, name }`. Add `listStudents(courseId)`, `addStudent(courseId, name)` (reject if course full), `removeStudent(courseId, studentId)`; keep `enrolled` in sync with the count for that course.
2. **`server/server.js`** - add nested routes; cascade-remove students in the course `delete` route.
3. **`client/src/api.js`** + **`App.jsx`** - add the calls and an expandable roster UI with an add-student input.

### How to test
Add two students, confirm `enrolled` becomes 2; remove one -> 1; deleting the course removes its students.

---

## Story 5: Sort by available seats
**As a** user, **I want** to sort by openness, **so that** I see courses with space first.

### Acceptance criteria
- [ ] A "Sort" control offers Code (A-Z) and Most available seats.
- [ ] Sorting respects the active level filter and search.

### Implementation plan
1. **`server/server.js`** - read `sort = "code"` in `GET /api/courses`; after filtering, sort: `code` -> `localeCompare`; `available` -> by `(b.capacity-b.enrolled) - (a.capacity-a.enrolled)`.
2. **`client/src/App.jsx`** - add `sort` to `filters` and a `<select>`.

### How to test
With several courses, choose "Most available seats", confirm fully open courses lead and full ones sink.

