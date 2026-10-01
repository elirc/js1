# Trace lab: normalization, uniqueness and whole-number invariants

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
  code: "astra-101",
  title: "Astra lesson",
  instructor: "Junior Mentor",
  capacity: 4,
  enrolled: 2,
  level: "Beginner",
};
test("normalized course codes are unique while an unchanged code can be edited", async () => {
  const made = await call("/api/courses", "POST", valid);
  assert.equal(made.status, 201);
  assert.equal(made.data.code, "ASTRA-101");
  assert.equal(
    (await call("/api/courses", "POST", { ...valid, code: " ASTRA-101 " }))
      .status,
    409,
  );
  const edited = await call("/api/courses/" + made.data.id, "PUT", {
    ...valid,
    title: "Updated lesson",
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.id, made.data.id);
});
test("counts must be finite whole numbers and enrollment cannot exceed capacity", async () => {
  for (const bad of [
    { capacity: "bad" },
    { capacity: 1.5 },
    { enrolled: -1 },
    { enrolled: 5 },
    { enrolled: null },
    { title: {} },
    { level: "Unknown" },
  ])
    assert.equal(
      (
        await call("/api/courses", "POST", {
          ...valid,
          code: "astra-invalid",
          ...bad,
        })
      ).status,
      400,
      JSON.stringify(bad),
    );
});

test("a fresh server instance starts from the seed, not from another instance's writes", async () => {
  // Closing and re-listening the same module keeps its arrays; only a new module instance
  // (or a new process) reseeds. The query string defeats the ES module cache.
  const seeded = (await call("/api/courses")).data.length;
  assert.equal((await call("/api/courses", "POST", { ...valid, code: "restart-1" })).status, 201);
  assert.equal((await call("/api/courses")).data.length, seeded + 1);
  const fresh = await import(new URL("../server/server.js", import.meta.url).href + "?instance=" + Date.now());
  const server = fresh.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const freshList = (await request(origin, "/api/courses")).data;
    assert.ok(freshList.length < seeded + 1, "a fresh instance does not see writes made to another instance");
    assert.ok(!freshList.some((c) => c.code === "RESTART-1"), "the course created above is absent in the fresh instance");
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create astra-101 with capacity 4 and enrolled 2: the returned code is ASTRA-101. A second equivalent code returns 409. Editing the original title succeeds. Capacity 1.5, enrollment 5 or null is rejected.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to send

`client/src/App.jsx`: the form posts all six fields (`code`, `title`, `instructor`, `capacity`, `enrolled`, `level`) from controlled inputs on create and edit; the browser sends numbers as strings, which is why the server accepts numeric strings.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `POST /api/courses`, `PUT /api/courses/:id`; the helper throws the server's `error` text on non-2xx, so the message you see comes from `validateCourse`.

### Boundary 3 — the middleware validates types, then normalizes

`server/server.js:77` `validateCourse`: the type gate (`isText`, `whole`) rejects wrong shapes; `normalizeCourse` (line 100) trims, uppercases the code and converts counts; then the level vocabulary, the 409 uniqueness scan (excluding the edited id) and the pre-existing `enrolled <= capacity` rule.

### Boundary 4 — the handler mutates the array

`POST` unshifts a new course with a `crypto.randomUUID()` id; `PUT` replaces the matching element. Both run synchronously, so no other request can interleave.

### Boundary 5 — the storage boundary is process memory

`courses` is a module-level array; a restart reseeds it (fourth test). There is nothing to commit and nothing to roll back.

### Boundary 6 — the response tells the client what happened

201/200 with the course, 400 with the specific message, 409 for a duplicate code. The client re-fetches the list after every write.

## Expected observations

| Action or input | Expected result |
|---|---|
| Create code with surrounding spaces and lowercase | Normalized uppercase code |
| Another id reuses normalized code | 409 conflict |
| Same id retains its code | Allowed edit |
| Capacity 2, enrolled 3 | 400; record unchanged |
| Fractional count | Rejected whole-number field |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Number("bad") yields NaN, whose lower-bound comparisons are false. Check representation and Number.isSafeInteger before applying capacity rules. Only then is enrolled <= capacity meaningful.

Uniqueness must use consistent normalization. Trim and uppercase the candidate before comparing codes. Exclude the edited id, or an unchanged code conflicts with itself. The array scan is appropriate for one process; a database version needs a uniqueness constraint because separate processes can otherwise both pass a preflight check. A controlled form assists users, but the API must validate direct requests too.

Pause near `validateCourse` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- normalized course codes are unique while an unchanged code can be edited
- counts must be finite whole numbers and enrollment cannot exceed capacity

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
