# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The ancestor check and move were separate operations. Two simultaneous moves could each see an acceptable old tree and together create a cycle.

**After:** Moves validate UUIDs and parent existence, lock structural changes within a transaction, check the subtree under the lock, then update. A node cannot become its own ancestor.

## Predict this example

Create roots A and B. Race A-under-B with B-under-A. Exactly one succeeds; the rejected move leaves a readable acyclic tree. Moving A under its own descendant is rejected even without concurrency.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 117. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
app.patch("/api/nodes/:id/move", asyncRoute(async (req, res, next) => {
  try {
    const id = req.params.id;
    const newParentId = req.body?.newParentId;
    if (newParentId !== null && !validId(newParentId)) throw new ValidationError("Choose a valid parent id or null for a root.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // All structural writers conflict with this lock; readers can continue.
      await client.query("LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE");
      const node = await client.query("SELECT id FROM nodes WHERE id=$1",[id]);
      if (!node.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Node not found." }); }
      if (newParentId !== null) {
        const parent = await client.query("SELECT id FROM nodes WHERE id=$1",[newParentId]);
        if (!parent.rows.length) throw new ValidationError("Parent does not exist.");
        const descendants = await client.query(`WITH RECURSIVE sub AS (
          SELECT id FROM nodes WHERE id=$1 UNION SELECT n.id FROM nodes n JOIN sub s ON n.parent_id=s.id
        ) SELECT id FROM sub WHERE id=$2`,[id,newParentId]);
        if (descendants.rows.length) throw new ValidationError("Cannot move a node beneath itself or a descendant.");
      }
      await client.query("UPDATE nodes SET parent_id=$2 WHERE id=$1",[id,newParentId]);
      await client.query("COMMIT"); res.json({ ok: true });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
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

Consider two roots A and B. Request one proposes A under B; request two proposes B under A. Both are valid against the initial tree. Checking first and updating later leaves a time-of-check/time-of-use gap. The transaction takes a SHARE ROW EXCLUSIVE table lock before validating the structure. The second writer waits, then sees the first committed move and rejects the cycle. A transaction alone at the default isolation level would not make two independent read-then-write checks safe.

The lock is deliberately broad: it serializes structural writers for this small teaching app. It is easy to explain and inspect, but reduces concurrent write throughput. A more scalable design requires a proven locking or serializable-retry strategy, not simply removing the lock. The API policy cannot prevent arbitrary direct SQL from creating a cycle if that SQL bypasses the validation. The recursive query and the lock solve different parts of the problem: reachability and concurrency.

## Three variations to work through

- **Normal variation — back to a root.** Move a child under `null`: predict 200 and the node listed at the top level of `/api/tree`.

- **Invalid variation — a cycle.** Move a root under its own child: predict 400 `Cannot move a node beneath itself or a descendant.` (first test). Move under a random UUID: predict 400 `Parent does not exist.`

- **Boundary variation — a held lock.** In `psql`, `BEGIN; LOCK TABLE nodes IN SHARE ROW EXCLUSIVE MODE;` and leave it open; call the move route: predict 503 after about three seconds with `Retry-After: 3`. `COMMIT` and retry: 200.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
