# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Two requests for one room from 10:00 to 11:00 UTC yield one 201 and one 409. An adjacent 11:00-to-12:00 slot succeeds. Extending the first to 11:30 fails and preserves its old end. Renaming preserves its id. A query window ending at 11:00 excludes the adjacent slot.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Add version-based stale-edit detection.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Display full dates across midnight.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Verify 23-hour and 25-hour day windows.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Make a booking belong to someone, and reject a cross-owner edit.

**Do not skip this one.** Every route in `server/src/index.ts` is unauthenticated: anyone who can
reach the API can move or delete anybody's meeting. The table already has a `booked_by` column
(`server/db/schema.sql`), but it is just a label - the server takes it from the request body
(`validation.ts:29`), so a caller can claim to be anyone, and nothing consults it when deciding
whether an update is allowed. This is the largest gap between this project and a real backend,
and it is the one CRUD skill the rest of the course does not teach.

### The task

1. **Identify the caller.** Read an `X-Actor` header and treat it as a trusted identity, with a
   comment saying plainly that this is a stand-in for a verified session or token and would be a
   security hole on a real deployment. Missing or blank → **401**. Building a login is a
   different lesson; do not.
2. **Stop trusting `bookedBy` from the body.** `POST` must stamp the actor. Decide what to do
   when the body *also* carries a `bookedBy` - ignore it, or 400 - and say which.
3. **Enforce it on writes.** `PUT` and `DELETE` must reject a booking owned by someone else.
4. **Decide reads.** Should Bob see Alice's 10:00 meeting in Birch? Almost certainly yes - a room
   calendar that hides bookings is useless - but he may not need her title. Write down whether
   you scope reads, redact fields, or neither, and why. This is a product decision, not a
   technical one, and noticing that is half the exercise.
5. **Migrate.** Existing rows have a `booked_by` that was never authenticated. What is it now?

### The one thing that makes this exercise different from the usual

Put the ownership test **in the statement**, not in the route:

```sql
UPDATE bookings SET ... WHERE id = $1 AND booked_by = $7
```

and treat `rowCount === 0` as the rejection. The tempting alternative - `SELECT` the row, compare
`booked_by` in JavaScript, then `UPDATE` - is the same check-then-act gap that this entire course
exists to teach you to distrust. It is exactly the shape that made a `SELECT`-for-overlap
unusable, and the exclusion constraint necessary. Ownership is a smaller window than overlap, but
it is the same window.

### 403 or 404?

- **403 Forbidden** is honest: the booking exists and is not yours. It also confirms that a given
  id exists, which lets a stranger enumerate your data.
- **404 Not Found** leaks nothing - "not yours" and "not there" become indistinguishable - at the
  cost of a support burden when a real user is confused.

Pick one, apply it to **both** write routes, and write one sentence in the code naming the threat
you decided mattered. Then write the test for the other and watch it fail, so you know the choice
is enforced rather than accidental.

### Acceptance tests

Model them on `test/booking.test.ts`, which already stands the real app up over HTTP against a
disposable schema:

- Alice creates a booking; the stored `booked_by` is **Alice**, even if the body said `"Bob"`.
- Bob `PUT`s Alice's booking with a valid body → your 403/404, **and** a direct
  `SELECT title, starts_at, ends_at FROM bookings WHERE id = $1` shows the row unchanged. Read it
  from the database, not from the response; a handler that rejects and writes anyway is invisible
  to a status-code assertion.
- Bob `DELETE`s Alice's booking → same status, and `SELECT count(*)` is still 1.
- No `X-Actor` header at all → 401, and nothing was written.
- Alice's own update still succeeds, so you have not simply broken the route.
- **The one people forget:** Bob books a slot that overlaps Alice's. That must still be a
  **409** from the exclusion constraint, not a 404 from your ownership check. Ownership and
  overlap are independent rules and it is easy to write a `WHERE` clause that silently swallows
  one into the other.

A reference solution is in [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md) under
"Ownership: reference solution". Attempt all six before opening it.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/src/validation.ts](../server/src/validation.ts) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
