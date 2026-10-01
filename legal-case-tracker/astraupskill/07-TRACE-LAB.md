# Trace lab: Legal Case Tracker: dependable record editing

[Course index](README.md) · [Worked change](03-WORKED-CHANGE.md) · [Tests](04-TESTING-AND-DEBUGGING.md)

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
const route = "/api/cases",
  statuses = ["Intake", "Discovery", "Negotiation", "Closed"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "Contract",
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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## The concrete case

This lab connects one visible action to the code that accepts or rejects it. Use a disposable dataset and write your prediction before running the operation. The goal is to explain what each boundary contributes, not to memorize a sequence of clicks.

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Intake to Discovery, then repeat Discovery: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

## Write the record before touching the form

The main record represents a case owner, case category, due date and amount. Shared fields include id, title, owner, category, status, priority, amount, dueDate and notes. Statuses are Intake, Discovery, Negotiation, Closed. Categories are Contract, Employment, Real Estate, Compliance. Activities reference the record ID. Records and activities live in JavaScript arrays and reset when the API process restarts.

Make a small table in your own notes with these columns: field, starting value, proposed value, and source of truth. Include identity even when the form does not display it. Include related rows or stored counters when the operation changes more than one fact. Mark a value as derived if the app recomputes it rather than storing it independently.

For example, an edit can change a title while preserving an ID. A status command can keep the same status while producing no new history. An import can contain many rows yet be rejected before any replacement begins. In each case, the meaningful observation is the promised resulting state. A success toast alone cannot establish which fields changed.

## Trace the real call path

### Boundary 1 — the React form or status button decides what to send

`client/src/App.jsx`: `handleSubmit` (line 88) sends the whole `form` object to `createItem` or `updateItem` depending on `editingId`; `changeStatus(item, status)` (line 120) sends only the new status. Neither handler validates anything itself: the browser's input types are the only client-side guard, and any server error surfaces through `setMessage(error.message)`. Write down which of the eight form fields reach the server on an edit (all of them, re-sent as a full object) versus a status change (one field).

### Boundary 2 — the client serializes the operation as an HTTP request

`client/src/api.js`: `updateStatus(id, status)` builds `PATCH /api/cases/:id/status` with body `{ status }`; `updateItem` builds `PUT /api/cases/:id` with the full record. The shared `request()` helper sets `Content-Type: application/json`, returns `null` on 204, and throws `new Error(data.error || "Request failed.")` when `response.ok` is false. So the text you see in the UI on a rejection is the server's `error` string, verbatim. Note that the client never sends an actor or version: nothing here identifies who is editing.

### Boundary 3 — the route parses and validates runtime input

`server/server.js:50` `app.patch("/api/cases/:id/status")` checks `STATUSES.includes(req.body.status)` inline and answers 400 `Choose a valid status.` otherwise. Create and full edit go through the `validateItem` middleware (line 97): type checks on every field, `validDate` for `dueDate` (line 349 rejects 2027-02-29 because the parsed components do not round-trip), the priority allowlist, then `normalizeItem` (line 151), then the length, status, category and `Number.isFinite(amount) && amount >= 0` checks. On success it replaces `req.body` with the normalized object, so the handler after it never sees raw client data.

### Boundary 4 — the repository applies the documented change to authoritative state

`createRepository().setStatus(id, status)` (line 290) is the changed function. It finds the record, returns the existing record untouched when `existing.status === status` (the idempotency guard: no `updatedAt` change, no activity entry), otherwise builds `updated`, builds one `activityEntry(id, "status", ...)`, replaces the record in `items` and unshifts the entry onto `activity`. Compare with `update(id, input)` (line 280), which always writes an `updated` entry; before Astra's change `setStatus` delegated to `update`, which is why every status click used to add a misleading history row.

### Boundary 5 — the storage boundary commits or rejects

There is no database: `items` and `activity` are arrays captured in the `createRepository` closure. `items = items.map(...)` and `activity.unshift(entry)` run synchronously with no `await` between them, so within one Node process no other request can observe the record changed but the history missing. That is the only reason the concurrent-PATCH test passes. Restarting the process reseeds from the two hard-coded cases; a real store would need a transaction to keep the same guarantee.

### Boundary 6 — the response tells the client what actually happened

The route answers `res.json(item)` with the updated record, or 404 `{ error: "CaseFile not found." }`. `changeStatus` in `App.jsx` then calls `refresh()` and, if the row is selected, `loadActivity(item.id)`: the UI re-reads the list and the activity feed from the server instead of trusting the PATCH response. That re-read is what makes the "one status entry" behavior visible in the browser.

## Predict the regression scenarios

| Scenario from the executable suite | Prediction to write before running |
|---|---|
| valid records round-trip and malformed edits leave the stored record intact | Initial records, request/input, expected result, and records that must remain unchanged. |
| equal sort keys give stable pages and an out-of-range page retains real totals | Initial records, request/input, expected result, and records that must remain unchanged. |
| repeated status requests produce one history entry for the actual change | Initial records, request/input, expected result, and records that must remain unchanged. |

Open the test file and identify the arrange, act and assert portions. Arrange creates the synthetic starting state. Act calls the real boundary. Assert reads the observable result. Some tests repeat a call or issue two calls together; explain why a single ordinary call would miss that defect. Tests may share a deliberate fixture within one suite, so read setup and earlier scenario state before copying one case into a standalone script.

## A successful request, described precisely

Start with a valid fixture from the test. Copy the values into your own learning notes rather than copying a personal record. State which fields are required, which may be omitted and which have a special meaning when empty. Execute the operation once. Compare the response with a fresh authoritative read, then compare the UI with that read. If the UI is still loading, wait for the actual expected condition instead of guessing a fixed delay.

Record the stable ID and one changed field. Record at least one field that must remain the same. If the operation creates a child, record the parent ID stored on the child. If it updates an aggregate, compute the expected aggregate by hand. If it restores a backup, count retained, ignored and recreated records according to this project’s documented policy. These observations make a small example reusable when the implementation changes.

## A rejected request, described precisely

Now change one value to a rejected case named in the test suite. Keep everything else identical. Predict where validation fails. Run it and capture both the feedback and the authoritative state afterward. Compare the saved record, related rows and relevant counters with their pre-request values. A controlled error is useful only if the application also preserves the intended state.

Do not assume that all failures have the same status or message. Invalid input, missing records, conflicts and infrastructure errors represent different conditions. Read this app’s handler or parser to see the actual result. Browser-only parsers return a success/error union or throw an import error rather than returning an HTTP status. Translate the same correctness idea into the contract this app actually exposes.

## Read the storage boundary

The server memory owns records. Use the Network panel to compare request JSON and response JSON, then restart the API to distinguish process memory from durable storage. The regression helper imports the actual app and calls it through HTTP.

Place a breakpoint immediately before the first write and another after the final write or publish step. On the success path, note what changed between those points. On the rejected-input path, the first write should never be reached when validation promises pre-write rejection. On a transactional failure path, some statements may execute and then roll back; reaching a write statement does not mean its effect committed.

An await marks a place where another operation can run. It does not itself define a transaction. When the test uses Promise.all, sketch request A and request B in two columns. Show where each acquires a lock or reads state. The test should accept either winner while insisting on the same final invariant. For synchronous or browser-only validation, explain why concurrency is outside the tested function rather than borrowing a database explanation that does not apply.

## Explain the design tradeoff

A status command expresses a desired value. If a legal case tracker record is already Discovery, setting it to Discovery again is not another business event. Compare the current value before writing. This makes retries easier to reason about, but it does not mean every create request is idempotent: repeating POST can still create a second record.

A date such as 2028-02-29 is a calendar label. Validate its shape and compare its parsed calendar components; 2027-02-29 has the right shape but is not a real day. Activity timestamps are instants and have different semantics. Amounts must be finite, nonnegative numbers: `server/server.js` checks `Number.isFinite(input.amount) && input.amount >= 0` and nothing else, so a value such as 12.505 is stored exactly as sent. Rounding or rejecting fractional cents is a proposed exercise in chapter 5, not implemented behavior. This scaffold does not perform external billing or legal casework.

A stable sort needs a secondary key. With several equal timestamps, ID determines the remaining order. Count matching records after filters, calculate the last page, clamp the request, then fetch that page. Synchronous array operations cannot interleave midway through an await because there is no await in that boundary. This explanation is specific to one process. Adding disk I/O or multiple API instances requires a new coordination design.

## Change one requirement independently

**Practice task:** Add a visible due-soon filter with a precisely defined date window.

Before implementation, write three acceptance criteria: an ordinary successful case, a rejected or cancelled case, and a case that preserves existing behavior. Identify the smallest file boundary that owns the rule. Keep the existing regression suite; add a test only when it observes a new promise. Do not reproduce the implementation line by line inside the assertion, because both copies can contain the same mistake.

After a first attempt, compare your design with this hint: Compare valid calendar labels against today and a documented inclusive end date; preserve other filters and reset or clamp pagination.

## Debug a disagreement between layers

If the form and response disagree, inspect the request payload before editing the database code. If the response and database disagree, inspect the mapper, transaction and read query. If a test fails before an HTTP request is logged, inspect startup, environment variables and the test fixture. Missing dependencies, a busy port or an unavailable database are different from a failed business assertion. Preserve the first useful error and fix that cause before interpreting later cascading failures.

When a date looks wrong, distinguish a calendar label from an instant and check the serialization boundary. When an optional field will not clear, distinguish omission from an explicit empty/null value. When a list seems to lose a record, inspect filtering, sorting and pagination before assuming deletion. When history duplicates, compare desired-state commands with commands that represent a new event. These are diagnostic questions to apply to the actual fields above.

## Final independent checkpoint

Close this guide and give a five-minute walkthrough using only the application source and one test. Explain the user-visible problem, the input contract, the identity model, the write boundary, a failed operation and the remaining limitation. Then modify the worked fixture and predict the result without running it. Reopen the guide only after writing your answer.

A useful review note includes the exact command run, its result, and the boundary it covers. Keep browser interaction, simulated storage tests, real HTTP/database tests and compile checks distinct. The [verification page](VERIFICATION.md) records this delivery’s evidence. Exercises and proposed extensions in this course remain learner work; they are not counted as implemented features.
