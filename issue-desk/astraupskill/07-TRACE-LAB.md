# Trace lab: independent filter dimensions and runtime validation

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
  title: "Astra priority lesson",
  status: "Backlog",
  priority: "High",
  assignee: "Junior",
  description: "Priority and status are independent.",
};
test("priority, status and search filters compose without changing records", async () => {
  await call("/api/issues", "POST", valid);
  await call("/api/issues", "POST", { ...valid, priority: "Low" });
  await call("/api/issues", "POST", { ...valid, status: "Done" });
  const rows = (
    await call("/api/issues?search=Astra&status=Backlog&priority=High")
  ).data;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priority, "High");
  assert.equal(rows[0].status, "Backlog");
  assert.equal((await call("/api/issues?priority=Unknown")).status, 400);
});
test("malformed issue text cannot overwrite existing details", async () => {
  const made = await call("/api/issues", "POST", valid);
  for (const bad of [{ title: {} }, { assignee: [] }, { description: 42 }])
    assert.equal(
      (await call("/api/issues/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
    );
  assert.deepEqual((await call("/api/issues/" + made.data.id)).data, made.data);
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

High/Backlog, Low/Backlog and High/Done issues containing Astra produce one match for Astra + Backlog + High. Unknown priority returns 400; malformed title cannot overwrite a saved issue.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the filters and the form decide what to send

`client/src/App.jsx`: search, status and priority controls change the list query; the form sends `title`, `assignee`, `status`, `priority`, `description`.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `GET /api/issues?search=&status=&priority=`, `POST`/`PUT /api/issues`; the browser URL-encodes the search text.

### Boundary 3 — the list route validates the query, the middleware validates the body

`server/server.js:18` rejects a non-string search or an unknown priority with 400; `validateIssue` (line 58) is the single text gate plus the status and priority vocabularies.

### Boundary 4 — the repository filters or mutates the array

`createIssueRepository()` (line 84): `list()` composes three predicates with `&&` and lower-cases the searchable text; `create`/`update` build trimmed objects.

### Boundary 5 — the storage boundary is process memory

one closure-held array; restart reseeds; synchronous handlers, no interleaving.

### Boundary 6 — the response tells the client what happened

the filtered array for lists, 201/200 with the issue, 400 with the specific message; the client re-fetches the list after a write.

## Expected observations

| Action or input | Expected result |
|---|---|
| High AND Backlog AND text | Intersection of all predicates |
| All priorities | Status and text remain active |
| Clear search | Priority and status remain active |
| Client URL | Includes priority parameter |
| Malformed text | Rejected before mutation |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

A High issue can be Backlog or Done. Filtering High and Backlog requires both predicates, plus the text predicate when supplied. OR would return unrelated records. Keep these dimensions separate rather than encoding one into another.

The client sends state via URLSearchParams; the API checks the vocabulary. A select helps ordinary users choose but cannot validate direct API requests. Bounded text checks precede trimming in repository methods. Use a small fixture matrix to prove composition rather than relying on a large seed list whose results are hard to predict.

Pause near `validateIssue` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- priority, status and search filters compose without changing records
- malformed issue text cannot overwrite existing details

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
