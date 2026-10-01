# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Status requests could add redundant history. Validation accepted malformed shapes, and page calculations lacked a consistent clamped result.

**After:** Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Actual changes update the in-memory record and append one status event. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

## Predict this example

Create a record titled "A lesson record" (the exact fixture in `test/workflow.test.*`; the seeded UI uses domain titles such as "Inspect west-wing ventilation") in category HVAC with status Open, amount 12.5 and dueDate 2028-02-29. Request Scheduled twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 37. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
  const item = repository.setStatus(req.params.id, status);
  if (!item) return res.status(404).json({ error: "WorkOrder not found." });
  res.json(item);
});
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Follow one concrete command: change "Inspect west-wing ventilation" from Open to Scheduled. The first successful command represents a real transition and adds one status event. Sending Scheduled again compares equal to current state, so it returns the record without adding another status event. Created, updated and note entries remain separate kinds; counting every timeline row would give the wrong assertion. This guarantee concerns repeated current values, not global request deduplication. After an intervening transition, requesting Scheduled can legitimately create a new event.

The repository owns the live array. Its status method checks existence, compares the current value, then changes the record and appends history synchronously. There is no await between those operations. This makes the repeat-safe behavior easy to trace inside one Node process, but it is not a durable database transaction or a multi-process coordination strategy. A server restart discards new records and history. The API tests use a fresh process fixture and real HTTP, so they check routing and validation as well as repository behavior.

Validation belongs at the API boundary even when the React controls constrain input. An object is not a valid title, an unknown priority is not silently accepted, and 2027-02-29 is not a real date. Normalization may trim a valid string, but should not stringify an object into a misleading title. For paging, count matching rows before clamping a request such as page 999. Sort by the selected field and then id so ties are deterministic on an unchanged dataset. The scaffold accepts its named statuses; it does not enforce a domain approval graph or actor permissions. A Open-to-Scheduled label change alone does not implement every real-world rule for a maintenance work order and its responsible technician.

## Three variations to work through

- **Normal variation — the same status twice.** `PATCH /status` to `Scheduled` twice: predict `[200, 200]`, one `status` entry, `updatedAt` set once.

- **Invalid variation — an impossible date.** `PUT` with `dueDate: "2027-02-29"`: predict 400 and the record unchanged (first test deep-equals it).

- **Boundary variation — a fresh instance.** Create a work order, start a fresh server instance (fourth test does it in-process; you can also restart the API), search for it: predict `total: 0`.

## Executable examples

These are the actual regression tests in [test/workflow.test.js](../test/workflow.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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
const route = "/api/work-orders",
  statuses = ["Open", "Scheduled", "In Progress", "Completed"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "HVAC",
  status: statuses[0],
  amount: 12.5,
  priority: "Medium",
  dueDate: "2028-02-29",
  notes: "A controlled regression fixture",
};
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);

test("valid records round-trip and malformed edits leave the stored record intact", async () => {
  const made = await call(route, "POST", valid);
  assert.equal(made.status, 201);
  assert.equal(made.data.dueDate, "2028-02-29");
  for (const bad of [
    { title: 44 },
    { title: "x".repeat(201) },
    { dueDate: "2027-02-29" },
    { priority: "Unknown" },
    { notes: {} },
    { amount: null },
  ]) {
    assert.equal(
      (await call(route + "/" + made.data.id, "PUT", { ...valid, ...bad }))
        .status,
      400,
      JSON.stringify(bad),
    );
  }
  assert.deepEqual((await call(route + "/" + made.data.id)).data, made.data);
  assert.equal(
    (
      await call(route + "/" + made.data.id + "/activity", "POST", {
        body: { bad: true },
      })
    ).status,
    400,
  );
});
test("equal sort keys give stable pages and an out-of-range page retains real totals", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await call(route, "POST", { ...valid, title: "Astrafixture shared" }))
        .status,
      201,
    );
  const filter = "?search=Astrafixture&sort=title&dir=asc&pageSize=2";
  const first = (await call(route + filter + "&page=1")).data,
    again = (await call(route + filter + "&page=1")).data;
  assert.equal(first.total, 3);
  assert.deepEqual(
    first.items.map((x) => x.id),
    again.items.map((x) => x.id),
  );
  const last = (await call(route + filter + "&page=999")).data;
  assert.equal(last.total, 3);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 1);
  const empty = (await call(route + "?search=absolutelyabsentfixture&page=999"))
    .data;
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
  const fraction = (await call(route + "?page=1.5&pageSize=Infinity")).data;
  assert.equal(fraction.page, 1);
  assert.equal(fraction.pageSize, 6);
});
test("repeated status requests produce one history entry for the actual change", async () => {
  const made = await call(route, "POST", valid),
    path = route + "/" + made.data.id;
  const responses = await Promise.all([
    call(path + "/status", "PATCH", { status: statuses[1] }),
    call(path + "/status", "PATCH", { status: statuses[1] }),
  ]);
  assert.deepEqual(
    responses.map((x) => x.status),
    [200, 200],
  );
  const entries = (await call(path + "/activity")).data;
  assert.equal(entries.filter((x) => x.kind === "status").length, 1);
  assert.equal((await call(path)).data.status, statuses[1]);
  assert.equal(
    (await call(path + "/status", "PATCH", { status: "Unknown" })).status,
    400,
  );
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
