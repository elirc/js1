# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Dates were checked only for presence. NaN and fractional registration counts could pass comparisons.

**After:** Events require bounded text, real YYYY-MM-DD dates and whole capacity/registration counts. Registered cannot exceed capacity (a rule that pre-dates the change; the change added the type and calendar gate in front of it). Invalid updates preserve the previous event.

## Predict this example

2028-02-29 with capacity 3 and registered 3 succeeds. 2027-02-29, 2028-04-31, registered 4 and capacity "bad" fail without replacing a saved event.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 66. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function validateEvent(req, res, next) {
  if (!["name","location"].every(key => isText(req.body[key],1)) || !realDate(req.body.date) || !whole(req.body.capacity,1,100000) || !whole(req.body.registered,0,100000))
    return res.status(400).json({ error: "Use text, a real calendar date and whole capacity/registration counts." });
  const event = normalizeEvent(req.body);
  if (!event.name || !event.location || !event.date) {
    return res.status(400).json({ error: "Name, location, and date are required." });
  }
  if (event.capacity < 1 || event.registered < 0 || event.registered > event.capacity) {
    return res.status(400).json({ error: "Capacity and registered counts are invalid." });
  }
  if (!["Open", "Waitlist", "Closed"].includes(event.status)) {
    return res.status(400).json({ error: "Choose a valid event status." });
  }
  next();
}

```

## What pre-existed and what changed

`registered <= capacity` was already enforced before Astra's change. What the change added is the gate in front of it: `isText` for text fields, `realDate` for the calendar date (so `2027-02-29` is rejected instead of rolling into March), and `whole` for both counts, so the cross-field rule now runs on values that are guaranteed to be whole numbers. In the fix pass the duplicated lower-layer checks were removed, leaving one gate per rule.

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A regular expression recognizes the shape of 2027-02-29 but cannot decide if it exists. Parse a UTC reference date and compare the result with the original label; rollover exposes invalid days. UTC validates the label without assigning a time to the event.

Validate each count before relating them. A full event is valid, so equality must pass; one registration beyond capacity must fail. Missing, null, fractional and nonnumeric values deserve separate fixtures because JavaScript conversions can make them look deceptively similar. Rejection must happen before replacing the original record.

## Three variations to work through

- **Normal variation — a real leap day.** `POST` with `date: "2028-02-29"`. Predict 201 and the stored date unchanged. `PUT` the same event with `registered: capacity`: predict 200 (full is allowed).

- **Invalid variation — an impossible date.** `PUT` with `date: "2027-02-29"`. Predict 400 from `realDate` and the stored event unchanged (the first test deep-equals it). Then `registered: capacity + 1`: predict 400 `Registered count cannot exceed capacity.`

- **Boundary variation — a string count.** `POST` with `capacity: "10"`. Predict 201, because `whole` accepts numeric strings and `normalizeEvent` converts them; then `capacity: "ten"`: predict 400 from the type gate.

## Executable examples

These are the actual regression tests in [test/api.test.js](../test/api.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
