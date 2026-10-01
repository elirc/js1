# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Follow-up dates were not validated and matching applications followed insertion order.

**After:** Text fields are bounded and typed. Nonempty next-step dates must be real dates. Filtered results sort by date, place undated applications last, and use ids for ties.

## Predict this example

Dates March 10, March 1 and empty display as March 1, March 10, empty. An invalid follow-up edit returns 400 and leaves the original application identical.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 67. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function validateApplication(req, res, next) {
  if (!["company","role"].every(key => isText(req.body[key],1)) ||
      req.body.contact !== undefined && !isText(req.body.contact) || req.body.notes !== undefined && !isText(req.body.notes,0,10000) ||
      req.body.nextStepDate !== undefined && req.body.nextStepDate !== "" && !realDate(req.body.nextStepDate))
    return res.status(400).json({ error: "Use text fields and a real next-step date, or leave the date blank." });
  const application = normalizeApplication(req.body);
  const stages = ["Saved", "Applied", "Interviewing", "Offer", "Closed"];

  if (!application.company || !application.role) {
    return res.status(400).json({ error: "Company and role are required." });
  }

  if (!stages.includes(application.stage)) {
    return res.status(400).json({ error: "Choose a valid stage." });
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

Empty and invalid are different. Leaving a follow-up unscheduled is intentional; February 30 is malformed. Preserve the empty-string convention while rejecting invalid nonempty labels.

Undated applications should not acquire invented urgency. The comparison places their sentinel after valid dates, then uses id for stable ties. Sorting the filtered copy preserves the underlying collection. This is chronological display ordering, not a reminder service: it sends no notifications and changes no workflow stages automatically. A rejected edit must leave the saved application intact.

## Three variations to work through

- **Normal variation — undated last.** Create three applications: dated `2099-01-02`, undated, dated `2099-01-01`. Predict the list order (`01-01`, `01-02`, undated) and confirm with `GET`.

- **Invalid variation — an impossible follow-up.** `PUT` with `nextStepDate: "2027-02-29"`. Predict 400 from `realDate` and the stored record unchanged (second test). Then `nextStepDate: ""`: predict 200 and the date cleared.

- **Boundary variation — equal dates.** Three applications with the same date: predict identical id order on two requests (new third test), then remove `|| a.id.localeCompare(b.id)` on a throwaway branch and see whether V8's stable sort still happens to agree (it will; the tie-break is for SQL and for future array changes).

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
