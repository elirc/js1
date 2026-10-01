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

## Existing implementation

Codes and text are bounded and typed. Capacity/enrollment must be whole counts, enrollment cannot exceed capacity, levels are constrained, and normalized codes are unique across other records. Editing can retain its own code.

The key model is: Courses contain id, uppercase code, title, instructor, capacity, enrolled and level. Available seats is capacity minus enrolled. Records are in server memory and reset on restart.

The worked fixture should behave as follows: Create astra-101 with capacity 4 and enrolled 2: the returned code is ASTRA-101. A second equivalent code returns 409. Editing the original title succeeds. Capacity 1.5, enrollment 5 or null is rejected.

## Extension solutions

### Exercise 1

**Prompt:** Add an enroll-one command.

**Approach:** Compute from the current course and validate before publishing; do not accept an arbitrary replacement record.

**Review:** your test must show `[200, 400]` for two concurrent enrolls and `enrolled === capacity` afterwards, and the handler must go through `validateCourse`-style checks (no negative or fractional increments).

### Exercise 2

**Prompt:** Show a derived full-course badge.

**Approach:** Use enrolled === capacity rather than storing a second mutable flag.

**Review:** the badge must be derived at render time (no new field on the record) and the test must assert it toggles after an enroll and after a capacity change without a page reload.

### Exercise 3

**Prompt:** Move uniqueness into a database.

**Approach:** Normalize before saving and enforce a unique normalized code in SQL; test competing inserts.

**Review:** the uniqueness test must include a direct database insert that violates `UNIQUE (code)` and assert the constraint error, plus the unchanged 409 through the API.

### Exercise 4

**Prompt:** Preview capacity reductions.

**Approach:** Display proposed capacity minus enrollment and reject a negative result rather than deleting enrollments.

**Review:** the preview endpoint must be a `GET` with no side effects (deep-equal the record before and after) and must compute the overflow from the stored `enrolled`, not from the request.

### Exercise 7 — ownership and authorization

Reference: `app.use((req, _res, next) => { req.actor = String(req.get("X-Actor") || "").trim(); next(); })`, a `requireActor` middleware for writes, and in `PUT`/`DELETE` compare `existing.owner !== req.actor` before mutating. `POST` stamps `owner: req.actor`. Extend `request()` in `test/http.js` with a headers argument.

Review: the comparison happens before `courses = courses.map(...)`, so a rejected edit never touches the array; explain why 403 rather than 404 is acceptable here (course codes are public in the list).

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: NaN and fractional counts could evade simple comparisons, and equivalent course codes could be created twice. I changed the implementation so that: Codes and text are bounded and typed. Capacity/enrollment must be whole counts, enrollment cannot exceed capacity, levels are constrained, and normalized codes are unique across other records. Editing can retain its own code. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
