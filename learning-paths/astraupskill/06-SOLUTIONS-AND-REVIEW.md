# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, request } from "./database.js";
let h;
before(async () => {
  h = await database();
});
after(async () => {
  if (h) await h.close();
});
const route = "/api/paths",
  statuses = ["Planned", "In Progress", "Blocked", "Complete"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "Frontend",
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

test("a failed activity insert rolls back the status update", async () => {
  const made = await call(route, "POST", valid),
    id = made.data.id,
    path = route + "/" + id;
  await h.admin.query(
    `CREATE FUNCTION reject_lesson_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='status' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
  );
  await h.admin.query(
    "CREATE TRIGGER fail_lesson_audit BEFORE INSERT ON activity_entries FOR EACH ROW EXECUTE FUNCTION reject_lesson_audit()",
  );
  try {
    assert.equal(
      (await call(path + "/status", "PATCH", { status: statuses[1] })).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
    assert.equal((await call(path + "/activity")).data.length, 1);
  } finally {
    await h.admin.query("DROP TRIGGER fail_lesson_audit ON activity_entries");
  }
  assert.equal(
    (await call(path + "/status", "PATCH", { status: statuses[1] })).status,
    200,
  );
});
```

## Existing implementation

Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Status and audit writes use one row-locked transaction; count and rows share a repeatable-read snapshot. Seed dates map to the intended column. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

The key model is: This app represents a learning plan and its mentor. A record uses generic fields id, title, owner, category, status, priority, amount, dueDate and notes. Categories are Frontend, Backend, Data, Leadership. Statuses are Planned, In Progress, Blocked, Complete. The UI gives these shared fields domain-specific labels. Learning milestone date is represented as a YYYY-MM-DD calendar string, not an instant. PostgreSQL items and activity_entries tables persist records and their child history.

The worked fixture should behave as follows: The worked fixture is defined once in [chapter 3](03-WORKED-CHANGE.md#predict-this-example); use those exact values here.

## Extension solutions

### Exercise 1

**Prompt:** Show completed learning milestones

**Approach:** Add milestone records with evidence and completion dates rather than treating the plan status as proof of every skill.

**Review:** the panel must be a filtered query, not a client-side filter over the whole list, and the test must compare its count with the stats endpoint.

### Exercise 2

**Prompt:** Add a UI confirmation for changing In Progress back to Planned.

**Approach:** Cancellation must preserve state and history. Confirmation calls the existing status endpoint; keep server validation and repeat-safe handling because API callers can bypass the dialog.

**Review:** the confirmation must gate the client request; the server no-op guard must be exercised by a repeated confirm and produce one entry.

### Exercise 3

**Prompt:** Add a regression for a learning milestone date at a leap-year boundary.

**Approach:** Use 2028-02-29 as valid and 2027-02-29 as invalid. Assert the valid string survives a read and the rejected edit leaves the old record unchanged; do not test only error wording.

**Review:** the regression must assert `typeof dueDate === 'string'` on read, which is what `setTypeParser(1082, ...)` guarantees, and an unchanged record after the 400.

### Exercise 4

**Prompt:** Require evidence before completion

**Approach:** Define the evidence contract, check it in the same transaction as the status change and explain the rejected transition in the UI.

**Review:** the evidence rule must run after the row lock and before the `UPDATE`, answer 400, and the activity insert must carry the evidence text in the same transaction.

### Exercise 7 — ownership and authorization

Reference: an actor middleware; in the `PATCH /status` transaction compare `current.rows[0].custodian` with `req.actor` after the `FOR UPDATE` and throw a `ForbiddenError` (403) before the `UPDATE`; `POST` sets `custodian` from the header.

Review: the check is on the locked row; explain why the display `owner` field is not authorization.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/workflow.test.ts](../test/workflow.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Status requests could add redundant history. Validation accepted malformed shapes, and page calculations lacked a consistent clamped result. Separate status and history writes could disagree after a late failure; separate count/page queries could see different snapshots. Seed dueDate values also needed correct JSON-to-SQL field mapping. I changed the implementation so that: Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Status and audit writes use one row-locked transaction; count and rows share a repeatable-read snapshot. Seed dates map to the intended column. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
