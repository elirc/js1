# Trace lab: row locks, atomic updates and meaningful audit events

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

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

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/feature.test.ts](../test/feature.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create a ticket, resolve it twice, and read history. There is one status event. Repeat assigning the same agent with the same expectation. Force a late related write to fail and verify that the earlier ticket changes did not commit.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the ticket form and action buttons decide what to send

`client/src/App.tsx`: the form sends `subject`, `body`, `priority`, `assigneeId` and `labelIds` on create and edit; status and assignee buttons send single-field `PATCH`es.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `POST /api/tickets`, `PUT /api/tickets/:id`, `PATCH /api/tickets/:id/status`, `PATCH /api/tickets/:id/assignee`; the envelope's `error` string is what the UI shows.

### Boundary 3 — the route validates the shape

`parseTicket` (`server/src/index.ts:269`) with `asEnum` for the priority; `recordId(req)` rejects a malformed id before any query; `asyncRoute` forwards errors to the middleware (`ValidationError` -> 400).

### Boundary 4 — the transaction locks the row and decides

`PATCH /status` (line 171): `withTransaction` -> `SELECT status FROM tickets WHERE id=$1 FOR UPDATE` -> if equal, return without writing -> `UPDATE` -> `logEvent` on the same client. `PUT` (line 148): `UPDATE` the row, `DELETE` + `INSERT` the label junction rows, log `edited`.

### Boundary 5 — PostgreSQL commits everything or nothing

`withTransaction` (`server/src/db.ts`) wraps `BEGIN`/`COMMIT`/`ROLLBACK`; the fourth test rejects the event insert with a trigger and shows the status did not change.

### Boundary 6 — the response tells the client what happened

`res.json(await loadTicket(id))` re-reads the ticket with labels and agent resolved; 404 when the locked select found nothing; the client re-fetches the event list.

## Expected observations

| Action or input | Expected result |
|---|---|
| Same status twice | One actual status event |
| Same assignment twice | No redundant assignment event |
| Missing agent reference | Rejected relationship |
| Late related write fails | Earlier transactional work rolls back |
| Different concurrent commands | Serialized changes; scheduling order is not predetermined |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

An audit event should describe a transition, not merely a button click. With status Open, requesting Resolved twice should produce one Open-to-Resolved event. Both requests must compare against the current locked row. Otherwise two concurrent callers can each read Open and both log the same transition. SELECT FOR UPDATE makes the second caller wait and inspect the committed value.

The same idea applies to assignment, including assigning the same agent twice. The update and corresponding event belong in the same transaction and use the same database client. Throwing after one successful query does not undo that query unless it is inside a transaction that rolls back. Foreign keys protect references, but a malformed UUID should be rejected before it becomes an opaque database error. This is repeat-safe current-state handling, not global request deduplication: if another valid transition happens between two commands, the later command may create a new event.

Pause near `FOR UPDATE` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- repeated status and assignment commands record only actual changes
- a late invalid label reference rolls back edits and earlier label deletion
- an audit write failure cannot commit a ticket status change

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
