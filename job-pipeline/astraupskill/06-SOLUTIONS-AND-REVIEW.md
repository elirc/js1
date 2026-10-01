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

## Existing implementation

Text fields are bounded and typed. Nonempty next-step dates must be real dates. Filtered results sort by date, place undated applications last, and use ids for ties.

The key model is: Applications contain id, company, role, stage, contact, nextStepDate and notes. Empty nextStepDate means unscheduled. Stage and search filter an in-memory collection.

The worked fixture should behave as follows: Dates March 10, March 1 and empty display as March 1, March 10, empty. An invalid follow-up edit returns 400 and leaves the original application identical.

## Extension solutions

### Exercise 1

**Prompt:** Add an overdue filter with an injected today.

**Approach:** Compare only valid nonempty labels and supply today explicitly in tests.

**Review:** the filter must compare fixed-width strings (`nextStepDate < today`) and exclude undated records explicitly; the test must cover the boundary day and an undated application.

### Exercise 2

**Prompt:** Record follow-up completion.

**Approach:** Separate completion history from scheduling the next date; define their atomic boundary.

**Review:** `complete` must be idempotent (assert `completedAt` unchanged on the second call) and the cleared date must send the record to the end of the default sort.

### Exercise 3

**Prompt:** Offer company sorting.

**Approach:** Whitelist sort choices and use normalized company plus id.

**Review:** the company sort must lower-case before comparing and fall back to `id`; the test fetches twice and asserts identical order; explain why case-insensitive sorting still needs a tie-break.

### Exercise 4

**Prompt:** Test changing a date to empty.

**Approach:** Preserve id and verify the application moves after dated matches.

**Review:** the two tests must be separate and each must read the record back; explain the difference between `undefined` (absent), `""` (clear) and a value in `validateApplication` (line 67).

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `owner` stamped on `POST`, and `applications.filter(a => a.owner === req.actor)` in the list before search and stage filters. Extend `request()` in `test/http.js` with a headers argument.

Review: explain why 404 rather than 403 here (a job seeker should not learn that someone else's application id exists).

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Follow-up dates were not validated and matching applications followed insertion order. I changed the implementation so that: Text fields are bounded and typed. Nonempty next-step dates must be real dates. Filtered results sort by date, place undated applications last, and use ids for ties. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
