# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** NaN and fractional counts could evade simple comparisons, and equivalent course codes could be created twice.

**After:** Codes and text are bounded and typed. Capacity/enrollment must be whole counts, enrollment cannot exceed capacity, levels are constrained, and normalized codes are unique across other records. Editing can retain its own code.

## Predict this example

Create astra-101 with capacity 4 and enrolled 2: the returned code is ASTRA-101. A second equivalent code returns 409. Editing the original title succeeds. Capacity 1.5, enrollment 5 or null is rejected.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 77. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function validateCourse(req, res, next) {
  if (!["code","title","instructor"].every(key => isText(req.body[key],1)) || !whole(req.body.capacity,1,100000) || !whole(req.body.enrolled,0,100000))
    return res.status(400).json({ error: "Use text fields and whole capacity/enrollment counts." });
  const course = normalizeCourse(req.body);
  if (!["Beginner","Intermediate","Advanced"].includes(course.level)) return res.status(400).json({ error: "Choose a valid level." });
  if (courses.some(existing => existing.id !== req.params.id && existing.code === course.code))
    return res.status(409).json({ error: "A course with this code already exists." });

  if (!course.code || !course.title || !course.instructor) {
    return res.status(400).json({ error: "Code, title, and instructor are required." });
  }

  if (course.capacity < 1 || course.enrolled < 0) {
    return res.status(400).json({ error: "Capacity and enrolled counts must be valid numbers." });
  }

  if (course.enrolled > course.capacity) {
    return res.status(400).json({ error: "Enrollment cannot exceed capacity." });
  }

  next();
}

```

## One gate per rule

Before the fix pass `validateCourse` had two layers: the new type gate (`isText`, `whole`) and, below it, the original string and number checks that could no longer be reached. Two layers for one rule are a maintenance hazard: a future edit to the lower one silently does nothing, and a reader cannot tell which message a client will see. The rule now: each input rule has exactly one gate, and the cross-field rule `enrolled <= capacity` (which pre-dates the change) is the only check after normalization. Note also what the change did *not* add: `enrolled <= capacity` already existed; the change added the type gate, the normalized-code uniqueness (409) and the level vocabulary in front of it.

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Number("bad") yields NaN, whose lower-bound comparisons are false. Check representation and Number.isSafeInteger before applying capacity rules. Only then is enrolled <= capacity meaningful.

Uniqueness must use consistent normalization. Trim and uppercase the candidate before comparing codes. Exclude the edited id, or an unchanged code conflicts with itself. The array scan is appropriate for one process; a database version needs a uniqueness constraint because separate processes can otherwise both pass a preflight check. A controlled form assists users, but the API must validate direct requests too.

## Three variations to work through

- **Normal variation — normalized code.** `POST` with `code: "  astra-102 "`. Predict 201 with `code: "ASTRA-102"`; then `PUT` the same course with the same code: predict 200 (the edited id is excluded from the uniqueness scan).

- **Invalid variation — a fractional capacity.** `POST` with `capacity: 2.5`. Predict 400 `Use text fields and whole capacity/enrollment counts.` from the type gate and no new course. Then `capacity: "3"` (a string): predict 201, because `whole` accepts numeric strings.

- **Boundary variation — restart.** Create a course, stop and start the API, list again. Predict the course is gone (in-memory), which the fourth test now pins.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
