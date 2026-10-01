# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

```typescript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, request } from "./database.js";
let h;
before(async () => {
  h = await database();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
async function fixture() {
  const agents = (await call("/api/agents")).data,
    labels = (await call("/api/labels")).data;
  return {
    subject: "Astra support lesson",
    body: "Explain one transaction",
    priority: "normal",
    assigneeId: agents[0].id,
    labelIds: labels.slice(0, 1).map((x) => x.id),
  };
}
test("repeated status and assignment commands record only actual changes", async () => {
  const made = await call("/api/tickets", "POST", await fixture());
  assert.equal(made.status, 201);
  const path = "/api/tickets/" + made.data.id;
  const result = await Promise.all([
    call(path + "/status", "PATCH", { status: "resolved" }),
    call(path + "/status", "PATCH", { status: "resolved" }),
  ]);
  assert.deepEqual(
    result.map((x) => x.status),
    [200, 200],
  );
  await call(path + "/assignee", "PATCH", { assigneeId: null });
  await call(path + "/assignee", "PATCH", { assigneeId: null });
  const events = (await call(path + "/events")).data;
  assert.equal(events.filter((x) => x.kind === "status").length, 1);
  assert.equal(events.filter((x) => x.kind === "assignment").length, 1);
});
test("a late invalid label reference rolls back edits and earlier label deletion", async () => {
  const input = await fixture(),
    made = await call("/api/tickets", "POST", input),
    path = "/api/tickets/" + made.data.id;
  const changed = await call(path, "PUT", {
    ...input,
    subject: "Must roll back",
    labelIds: [randomUUID()],
  });
  assert.equal(changed.status, 400);
  assert.deepEqual((await call(path)).data, made.data);
  assert.equal((await call(path + "/events")).data.length, 1);
  assert.equal(
    (await call("/api/tickets", "POST", { ...input, subject: {} })).status,
    400,
  );
});
test("an audit write failure cannot commit a ticket status change", async () => {
  const made = await call("/api/tickets", "POST", await fixture()),
    path = "/api/tickets/" + made.data.id;
  await h.admin.query(
    "CREATE FUNCTION reject_ticket_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='status' THEN RAISE EXCEPTION 'injected log failure'; END IF; RETURN NEW; END $$",
  );
  await h.admin.query(
    "CREATE TRIGGER reject_ticket_log BEFORE INSERT ON ticket_events FOR EACH ROW EXECUTE FUNCTION reject_ticket_log()",
  );
  try {
    assert.equal(
      (await call(path + "/status", "PATCH", { status: "closed" })).status,
      500,
    );
    assert.deepEqual((await call(path)).data, made.data);
  } finally {
    await h.admin.query("DROP TRIGGER reject_ticket_log ON ticket_events");
  }
});
```

## Existing implementation

Status and assignment read the current ticket under a row lock, return it unchanged for a repeated value, and record actual changes transactionally. Input and UUID validation reject malformed requests; failed related writes roll back.

The key model is: Tickets reference agents and labels. A ticket has current status and optional assigned agent; history explains actual changes. Junction rows connect tickets to labels. These separate rows must remain consistent with the ticket operation that creates them.

The worked fixture should behave as follows: Create a ticket, resolve it twice, and read history. There is one status event. Repeat assigning the same agent with the same expectation. Force a late related write to fail and verify that the earlier ticket changes did not commit.

## Extension solutions

### Exercise 1

**Prompt:** Disable the currently selected status action.

**Approach:** Improve the control while retaining the server no-op guard; other callers can still submit the same status.

**Review:** the disabled button must be derived from the current ticket status, the client test must assert no request for the current status, and the server no-op guard must remain (the client is not the only caller).

### Exercise 2

**Prompt:** Explain assignment and unassignment in history.

**Approach:** Represent no agent explicitly as null and resolve labels for display without changing stored identity.

**Review:** the agent name must be resolved inside the same transaction as the event insert (one more `SELECT` on the locked ticket's client), `null` must render as `unassigned`, and the test must count exactly two events for assign/unassign/re-assign.

### Exercise 3

**Prompt:** Add a test for two different concurrent status commands.

**Approach:** Assert a valid serialized history and matching final status, not a predetermined scheduling order.

**Review:** the concurrent test must use `Promise.all`, read the events back ordered by time, and assert the chain is consistent (`to` of event 1 equals `from` of event 2) rather than a fixed winner; explain that `FOR UPDATE` serializes the two updates.

### Exercise 4

**Prompt:** Design an explicit allowed-transition graph.

**Approach:** Define legal edges and user feedback first. Validate while holding the row lock; no role or transition policy is currently inferred from the status names.

**Review:** the transition map must be checked after `SELECT ... FOR UPDATE` and before the `UPDATE`, the 409 must carry the current status, and the test must show the row and event count unchanged after an illegal move.

### Exercise 7 — ownership and authorization

Reference: a middleware attaching `req.actor`; `POST` stamps `requester`; in the `PUT`/`PATCH` transactions, `SELECT requester, assignee_id ... FOR UPDATE` and throw a `ForbiddenError` (mapped to 403) when neither matches, so the rollback releases the lock.

Review: the check is on the locked row inside the transaction; explain why an agent id in the request body must not be trusted for this decision.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/feature.test.ts](../test/feature.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Repeated status or assignment requests could append duplicate history even when the requested value already matched the ticket. I changed the implementation so that: Status and assignment read the current ticket under a row lock, return it unchanged for a repeated value, and record actual changes transactionally. Input and UUID validation reject malformed requests; failed related writes roll back. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
