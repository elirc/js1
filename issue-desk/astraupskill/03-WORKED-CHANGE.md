# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Issues had status/search filters but no priority filter, and text validators assumed strings.

**After:** Priority filtering composes with status and search in UI and API. Invalid priorities and malformed text return useful errors; updates preserve issue identity.

## Predict this example

High/Backlog, Low/Backlog and High/Done issues containing Astra produce one match for Astra + Backlog + High. Unknown priority returns 400; malformed title cannot overwrite a saved issue.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 58. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function validateIssue(req, res, next) {
  const { title, status, priority, assignee } = req.body;
  if (!isText(title,3) || !isText(assignee,2) || req.body.description !== undefined && !isText(req.body.description,0,10000))
    return res.status(400).json({ error: "Use bounded text for title, assignee and description." });
  const allowedStatuses = ["Backlog", "In Progress", "Review", "Done"];
  const allowedPriorities = ["Low", "Medium", "High", "Critical"];

  if (!title || title.trim().length < 3) {
    return res.status(400).json({ error: "Title must be at least 3 characters." });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Choose a valid status." });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({ error: "Choose a valid priority." });
  }

  if (!assignee || assignee.trim().length < 2) {
    return res.status(400).json({ error: "Assignee must be at least 2 characters." });
  }

  next();
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A High issue can be Backlog or Done. Filtering High and Backlog requires both predicates, plus the text predicate when supplied. OR would return unrelated records. Keep these dimensions separate rather than encoding one into another.

The client sends state via URLSearchParams; the API checks the vocabulary. A select helps ordinary users choose but cannot validate direct API requests. Bounded text checks precede trimming in repository methods. Use a small fixture matrix to prove composition rather than relying on a large seed list whose results are hard to predict.

## Three variations to work through

- **Normal variation — three filters.** Create issues with different priorities and statuses, then `GET /api/issues?search=lesson&status=Backlog&priority=High`. Predict which rows survive all three predicates (the first test).

- **Invalid variation — an unknown vocabulary.** `GET /api/issues?priority=Urgent`: predict 400 and no list. `PUT` with `title: "ab"`: predict 400 from the `isText` gate (minimum 3) and the stored issue unchanged (second test).

- **Boundary variation — encoded text.** Search for `Rendering & layout` through the browser: predict the request URL contains `%26` and the server still matches (third test).

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
