# Trace lab: calendar labels and cross-field validation

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

2028-02-29 with capacity 3 and registered 3 succeeds. 2027-02-29, 2028-04-31, registered 4 and capacity "bad" fail without replacing a saved event.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to send

`client/src/App.jsx`: six controlled inputs (`name`, `location`, `date`, `capacity`, `registered`, `status`); the date input yields `YYYY-MM-DD`.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `POST /api/events`, `PUT /api/events/:id`; the server's `error` text is what the form shows.

### Boundary 3 — the middleware validates, then normalizes

`server/server.js:66` `validateEvent`: the type and calendar gate (`isText`, `realDate`, `whole`), then `normalizeEvent`, then the cross-field `registered <= capacity` rule and the status vocabulary.

### Boundary 4 — the handler mutates the array

`POST` unshifts; `PUT` replaces the matching element; both synchronous.

### Boundary 5 — the storage boundary is process memory

`events` is a module-level array; restart reseeds; nothing to roll back.

### Boundary 6 — the response tells the client what happened

201/200 with the event, 400 with the specific message; the client re-fetches the list.

## Expected observations

| Action or input | Expected result |
|---|---|
| 2028-02-29 | Valid calendar date |
| 2027-02-29 | Rejected impossible date |
| Capacity 5, registered 5 | Valid boundary |
| Capacity 5, registered 6 | Rejected cross-field invariant |
| Object-valued location | 400 before string operations |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

A regular expression recognizes the shape of 2027-02-29 but cannot decide if it exists. Parse a UTC reference date and compare the result with the original label; rollover exposes invalid days. UTC validates the label without assigning a time to the event.

Validate each count before relating them. A full event is valid, so equality must pass; one registration beyond capacity must fail. Missing, null, fractional and nonnumeric values deserve separate fixtures because JavaScript conversions can make them look deceptively similar. Rejection must happen before replacing the original record.

Pause near `validateEvent` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- real leap-day events round-trip and invalid edits preserve the event
- full capacity is allowed but one registration beyond it is rejected

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
