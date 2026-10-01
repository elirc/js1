# Trace lab: optional values and stable chronological sorting

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
  company: "AstraHiring",
  role: "Junior developer",
  stage: "Applied",
  contact: "Mentor",
  nextStepDate: "2028-03-10",
  notes: "",
};
test("follow-ups are sorted by date with undated records last and filters composed", async () => {
  await call("/api/applications", "POST", { ...valid, nextStepDate: "" });
  await call("/api/applications", "POST", valid);
  await call("/api/applications", "POST", {
    ...valid,
    nextStepDate: "2028-03-01",
  });
  const result = (
    await call("/api/applications?search=AstraHiring&stage=Applied")
  ).data;
  assert.deepEqual(
    result.map((x) => x.nextStepDate),
    ["2028-03-01", "2028-03-10", ""],
  );
  assert.equal(
    (await call("/api/applications?search=AstraHiring&stage=Offer")).data
      .length,
    0,
  );
});
test("invalid follow-up dates or field types do not overwrite an existing application", async () => {
  const made = await call("/api/applications", "POST", valid);
  for (const bad of [
    { nextStepDate: "2028-02-30" },
    { nextStepDate: [] },
    { company: {} },
    { notes: 42 },
  ])
    assert.equal(
      (
        await call("/api/applications/" + made.data.id, "PUT", {
          ...valid,
          ...bad,
        })
      ).status,
      400,
    );
  assert.deepEqual(
    (await call("/api/applications")).data.find((x) => x.id === made.data.id),
    made.data,
  );
});

test("equal follow-up dates keep a stable id order across requests", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal((await call("/api/applications", "POST", { ...valid, company: "Astrastable", nextStepDate: "2099-05-05" })).status, 201);
  const first = (await call("/api/applications?search=Astrastable")).data.map((x) => x.id);
  const again = (await call("/api/applications?search=Astrastable")).data.map((x) => x.id);
  assert.equal(first.length, 3);
  assert.deepEqual(first, again);
  assert.deepEqual(first, [...first].sort());
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Dates March 10, March 1 and empty display as March 1, March 10, empty. An invalid follow-up edit returns 400 and leaves the original application identical.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to send

`client/src/App.jsx`: six controlled inputs; the date input yields `YYYY-MM-DD` or `""` when cleared, which is the clear-the-date contract.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `POST`/`PUT /api/applications`; `GET /api/applications?search=&stage=`.

### Boundary 3 — the middleware validates, then normalizes

`server/server.js:67` `validateApplication`: `isText` for company/role, optional contact/notes bounds, `realDate` for a non-empty `nextStepDate` (blank allowed), then `normalizeApplication` and the stage vocabulary.

### Boundary 4 — the list handler filters and sorts

`server/server.js:27`: filter by search text and stage, then the sentinel-based date sort with the `id` tie-break (third test).

### Boundary 5 — the storage boundary is process memory

`applications` is a module-level array; restart reseeds; synchronous handlers, no interleaving.

### Boundary 6 — the response tells the client what happened

201/200 with the record, 400 with the specific message; the list is re-fetched after every write.

## Expected observations

| Action or input | Expected result |
|---|---|
| A March 2, B blank, C February 29 | C then A then B |
| Equal next-step dates | Stable id tie-breaker |
| Clear optional date | Undated application |
| Impossible date | 400; previous record unchanged |
| Change search | Only matches enter the sorted view |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Empty and invalid are different. Leaving a follow-up unscheduled is intentional; February 30 is malformed. Preserve the empty-string convention while rejecting invalid nonempty labels.

Undated applications should not acquire invented urgency. The comparison places their sentinel after valid dates, then uses id for stable ties. Sorting the filtered copy preserves the underlying collection. This is chronological display ordering, not a reminder service: it sends no notifications and changes no workflow stages automatically. A rejected edit must leave the saved application intact.

Pause near `validateApplication` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- follow-ups are sorted by date with undated records last and filters composed
- invalid follow-up dates or field types do not overwrite an existing application

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
