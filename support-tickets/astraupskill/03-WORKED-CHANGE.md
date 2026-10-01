# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Repeated status or assignment requests could append duplicate history even when the requested value already matched the ticket.

**After:** Status and assignment read the current ticket under a row lock, return it unchanged for a repeated value, and record actual changes transactionally. Input and UUID validation reject malformed requests; failed related writes roll back.

## Predict this example

Create a ticket, resolve it twice, and read history. There is one status event. Repeat assigning the same agent with the same expectation. Force a late related write to fail and verify that the earlier ticket changes did not commit.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 171. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
app.patch("/api/tickets/:id/status", asyncRoute(async (req, res, next) => {
  try {
    const status = asEnum(req.body.status, STATUSES);
    if (!status) return res.status(400).json({ error: "Invalid status." });
    const ok = await withTransaction(async (client) => {
      const current = await client.query<{ status: string }>("SELECT status FROM tickets WHERE id=$1 FOR UPDATE",[recordId(req)]);
      const currentRow = current.rows[0];
      if (!currentRow) return false;
      if (currentRow.status === status) return true;
      const { rowCount } = await client.query(
        "UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1",
        [recordId(req), status]
      );
      if (rowCount === 0) return false;
      await logEvent(client, recordId(req), "status", `Status changed to ${status}`);
      return true;
    });
    if (!ok) return res.status(404).json({ error: "Ticket not found." });
    res.json(await loadTicket(recordId(req)));
  } catch (error) {
    next(error);
  }
}));

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

An audit event should describe a transition, not merely a button click. With status Open, requesting Resolved twice should produce one Open-to-Resolved event. Both requests must compare against the current locked row. Otherwise two concurrent callers can each read Open and both log the same transition. SELECT FOR UPDATE makes the second caller wait and inspect the committed value.

The same idea applies to assignment, including assigning the same agent twice. The update and corresponding event belong in the same transaction and use the same database client. Throwing after one successful query does not undo that query unless it is inside a transaction that rolls back. Foreign keys protect references, but a malformed UUID should be rejected before it becomes an opaque database error. This is repeat-safe current-state handling, not global request deduplication: if another valid transition happens between two commands, the later command may create a new event.

## Three variations to work through

- **Normal variation — replace the label set.** `PUT` a ticket with `labelIds: [a, b]`, then with `[b]`, then with `[]`. Predict the `ticket_labels` row count after each (2, 1, 0) and one `edited` event per `PUT`.

- **Invalid variation — a bad priority.** `PUT` with `priority: "urgent!"`. Predict 400 from `asEnum` and the row, labels and events unchanged (the first test deep-equals the ticket).

- **Boundary variation — the same status twice, at once.** Two `PATCH /status` with the same value in a `Promise.all`: predict `[200, 200]` and exactly one status event; then two *different* statuses (exercise 3).

## Executable examples

These are the actual regression tests in [test/feature.test.ts](../test/feature.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
