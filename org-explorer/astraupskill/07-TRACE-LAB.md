# Trace lab: recursive queries, structural invariants and concurrent tree moves

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
test("self and descendant moves are rejected while moving back to a root is supported", async () => {
  const a = await call("/api/nodes", "POST", {
    name: "Astra root",
    title: "Root",
    parentId: null,
  });
  assert.equal(a.status, 201);
  const b = await call("/api/nodes", "POST", {
    name: "Astra child",
    title: "Child",
    parentId: a.data.id,
  });
  assert.equal(b.status, 201);
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: b.data.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: a.data.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + b.data.id + "/move", "PATCH", {
        newParentId: null,
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/nodes/" + b.data.id)).data.depth, 0);
});
test("opposing concurrent moves cannot introduce a cycle", async () => {
  const a = await call("/api/nodes", "POST", {
      name: "Concurrent A",
      title: "",
      parentId: null,
    }),
    b = await call("/api/nodes", "POST", {
      name: "Concurrent B",
      title: "",
      parentId: null,
    });
  const results = await Promise.all([
    call("/api/nodes/" + a.data.id + "/move", "PATCH", {
      newParentId: b.data.id,
    }),
    call("/api/nodes/" + b.data.id + "/move", "PATCH", {
      newParentId: a.data.id,
    }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
  const aa = (await call("/api/nodes/" + a.data.id)).data,
    bb = (await call("/api/nodes/" + b.data.id)).data;
  assert.equal(aa.depth + bb.depth, 1);
  assert.equal((await call("/api/tree")).status, 200);
});
test("invalid or nonexistent parent references leave the hierarchy unchanged", async () => {
  const a = await call("/api/nodes", "POST", {
    name: "Reference test",
    title: "",
    parentId: null,
  });
  assert.equal(
    (await call("/api/nodes/" + a.data.id + "/move", "PATCH", {})).status,
    400,
  );
  assert.equal(
    (
      await call("/api/nodes/" + a.data.id + "/move", "PATCH", {
        newParentId: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal((await call("/api/nodes/" + a.data.id)).data.depth, 0);
  assert.equal((await call("/api/nodes/invalid")).status, 400);
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/feature.test.ts](../test/feature.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create roots A and B. Race A-under-B with B-under-A. Exactly one succeeds; the rejected move leaves a readable acyclic tree. Moving A under its own descendant is rejected even without concurrency.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the tree view decides what to send

`client/src/App.tsx`: dragging a node onto another sends `{ newParentId }` (or `null` for a root) to the move route; the form sends `name`, `title`, `parentId` for create and edit.

### Boundary 2 — the request leaves the browser

`client/src/api.ts`: `PATCH /api/nodes/:id/move`, `POST`/`PUT /api/nodes`, `GET /api/tree`.

### Boundary 3 — the route validates the reference

`server/src/index.ts:117`: `validId(newParentId)` or `null`; anything else is 400 before a connection is taken.

### Boundary 4 — the transaction takes the lock and re-checks under it

`BEGIN` -> `SET LOCAL lock_timeout` -> `LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE` -> node exists (else 404 and rollback) -> parent exists (400) -> recursive CTE proves the new parent is not the node or a descendant (400) -> `UPDATE nodes SET parent_id`. Every check runs after the lock, so a concurrent move cannot make them stale.

### Boundary 5 — PostgreSQL commits or rolls back

`COMMIT` on success; any throw rolls back and the `finally` releases the client; `55P03` after three seconds becomes 503 (chapter 2). The test races two opposing moves and asserts `[200, 400]`.

### Boundary 6 — the response tells the client what happened

`{ ok: true }` on success; 400 with the specific reason; 404 for a missing node; the client re-fetches `/api/tree`.

## Expected observations

| Action or input | Expected result |
|---|---|
| R1 obtains structural lock | R2 waits |
| R1 moves root A under root B | One acyclic change commits |
| R2 tries B under A | Reads changed graph and rejects cycle |
| Missing parent | Rejected |
| Direct SQL bypasses API policy | Outside this cycle guarantee |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Consider two roots A and B. Request one proposes A under B; request two proposes B under A. Both are valid against the initial tree. Checking first and updating later leaves a time-of-check/time-of-use gap. The transaction takes a SHARE ROW EXCLUSIVE table lock before validating the structure. The second writer waits, then sees the first committed move and rejects the cycle. A transaction alone at the default isolation level would not make two independent read-then-write checks safe.

The lock is deliberately broad: it serializes structural writers for this small teaching app. It is easy to explain and inspect, but reduces concurrent write throughput. A more scalable design requires a proven locking or serializable-retry strategy, not simply removing the lock. The API policy cannot prevent arbitrary direct SQL from creating a cycle if that SQL bypasses the validation. The recursive query and the lock solve different parts of the problem: reachability and concurrency.

Pause near `SHARE ROW EXCLUSIVE` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- self and descendant moves are rejected while moving back to a root is supported
- opposing concurrent moves cannot introduce a cycle
- invalid or nonexistent parent references leave the hierarchy unchanged

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
