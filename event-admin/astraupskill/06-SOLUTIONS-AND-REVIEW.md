# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

```javascript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application, request } from "./http.js";
let h;
before(async () => {
  h = await application();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
const valid = {
  name: "Astra event",
  location: "Learning room",
  date: "2028-02-29",
  capacity: 3,
  registered: 2,
  status: "Open",
};
test("real leap-day events round-trip and invalid edits preserve the event", async () => {
  const made = await call("/api/events", "POST", valid);
  assert.equal(made.status, 201);
  for (const bad of [
    { date: "2027-02-29" },
    { date: "2028-04-31" },
    { capacity: "bad" },
    { registered: 4 },
    { registered: 1.5 },
    { name: 12 },
  ])
    assert.equal(
      (await call("/api/events/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
      JSON.stringify(bad),
    );
  const all = (await call("/api/events")).data;
  assert.deepEqual(
    all.find((x) => x.id === made.data.id),
    made.data,
  );
});
test("full capacity is allowed but one registration beyond it is rejected", async () => {
  assert.equal(
    (await call("/api/events", "POST", { ...valid, registered: 3 })).status,
    201,
  );
  assert.equal(
    (await call("/api/events", "POST", { ...valid, registered: 4 })).status,
    400,
  );
});
```

## Existing implementation

Events require bounded text, real YYYY-MM-DD dates and whole capacity/registration counts. Registered cannot exceed capacity. Invalid updates preserve the previous event.

The key model is: Event fields are id, name, location, date, capacity, registered and status. A calendar date is not an instant. Availability is derived; records remain in memory.

The worked fixture should behave as follows: 2028-02-29 with capacity 3 and registered 3 succeeds. 2027-02-29, 2028-04-31, registered 4 and capacity "bad" fail without replacing a saved event.

## Extension solutions

### Exercise 1

**Prompt:** Add register-one.

**Approach:** Compute and validate a candidate; a database version needs a conditional update or transaction.

**Review:** your test must show `[200, 400]` for two concurrent registrations and `registered === capacity` afterwards; the increment must go through the same cross-field rule as `PUT`.

### Exercise 2

**Prompt:** Model a waitlist separately.

**Approach:** Keep confirmed and waiting counts distinct; promotion changes both together.

**Review:** the waitlist must be its own structure with its own endpoint; `registered` never exceeds `capacity`; the test proves an entry is appended when full and not when a seat is free.

### Exercise 3

**Prompt:** Sort events chronologically.

**Approach:** Compare valid YYYY-MM-DD strings, then id for same-day ties.

**Review:** the sort must use a stable comparator (`date` then `id`) and the test must include two equal dates fetched twice; explain why `localeCompare` on `YYYY-MM-DD` strings is chronological.

### Exercise 4

**Prompt:** Extend the model to timed events.

**Approach:** Define a timezone and instant representation explicitly rather than appending an arbitrary Z.

**Review:** the instants must carry an explicit offset (reuse the regex idea from `realDate`), `endsAt > startsAt` must be checked after normalization, and the two status/date tests must be separate so a reviewer can see which rule fired.

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, and an owner comparison before `events = events.map(...)`; `POST` stamps `owner: req.actor`. Extend `request()` in `test/http.js` with a headers argument.

Review: the check must run before any mutation; explain why the organizer name in the body must not be used for authorization.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Dates were checked only for presence. NaN and fractional registration counts could pass comparisons. I changed the implementation so that: Events require bounded text, real YYYY-MM-DD dates and whole capacity/registration counts. Registered cannot exceed capacity. Invalid updates preserve the previous event. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
