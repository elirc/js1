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

## Existing implementation

Priority filtering composes with status and search in UI and API. Invalid priorities and malformed text return useful errors; updates preserve issue identity.

The key model is: An issue has id, title, status, priority, assignee, description and createdAt. Status is workflow position; priority is urgency. Filtered results derive from in-memory records.

The worked fixture should behave as follows: High/Backlog, Low/Backlog and High/Done issues containing Astra produce one match for Astra + Backlog + High. Unknown priority returns 400; malformed title cannot overwrite a saved issue.

## Extension solutions

### Exercise 1

**Prompt:** Add an assignee filter.

**Approach:** Validate its representation and add another AND predicate with combination tests.

**Review:** the assignee filter must be validated like `priority` (a string), compared case-insensitively, and composed with `&&` alongside the others; the test must cover a match, an empty result and the array-parameter 400.

### Exercise 2

**Prompt:** Order by priority rank.

**Approach:** Map Critical/High/Medium/Low to numeric ranks, then id; alphabetical order is not urgency.

**Review:** the sort must map priorities to numeric ranks (not alphabetical), fall back to `id`, and be tested with two equal priorities fetched twice.

### Exercise 3

**Prompt:** Distinguish filtered and global counts.

**Approach:** Label counts as filtered or fetch a separate summary.

**Review:** `total` must be computed before filtering and `matching` after, both on the server; the test asserts both numbers for one request.

### Exercise 4

**Prompt:** Ignore older search responses.

**Approach:** Use a request version or cancellation and protect success, error and loading updates.

**Review:** the guard must live where the response is applied (a `sequence` ref compared in the `.then`), and the test must resolve the older promise last.

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `reporter` stamped in `create`, and a comparison of `req.actor` with `existing.reporter` and `existing.assignee` before `update`. Extend `request()` in `test/http.js` with a headers argument.

Review: two allowed actors, one forbidden; the test must cover all three.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Issues had status/search filters but no priority filter, and text validators assumed strings. I changed the implementation so that: Priority filtering composes with status and search in UI and API. Invalid priorities and malformed text return useful errors; updates preserve issue identity. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
