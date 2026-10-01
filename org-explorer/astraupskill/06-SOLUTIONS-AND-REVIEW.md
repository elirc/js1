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

## Existing implementation

Moves validate UUIDs and parent existence, lock structural changes within a transaction, check the subtree under the lock, then update. A node cannot become its own ancestor.

The key model is: Each node has a UUID, name, title and nullable parent_id. A null parent means a root. Children point upward; recursive SQL discovers descendants. A valid forest may have several roots, but every parent chain must terminate.

The worked fixture should behave as follows: Create roots A and B. Race A-under-B with B-under-A. Exactly one succeeds; the rejected move leaves a readable acyclic tree. Moving A under its own descendant is rejected even without concurrency.

## Extension solutions

### Exercise 1

**Prompt:** Show the full ancestor breadcrumb for a selected node.

**Approach:** Walk parent ids with a visited set and show names from root to leaf; missing parents should produce an explicit diagnostic.

**Review:** the client guard must derive descendants from the tree the client already has, and the server 400 must still be exercised by an API-level test that bypasses the UI.

### Exercise 2

**Prompt:** Add a dry-run move endpoint that explains rejection.

**Approach:** Reuse validation, but explain that a dry run is advisory because the tree can change before the real move. The actual move must revalidate under its lock.

**Review:** the subtree query must reuse the recursive CTE with the root as its anchor, return 404 for an unknown root, and be tested for a leaf, a mid node and the root.

### Exercise 3

**Prompt:** Exercise three concurrent structural moves.

**Approach:** Use separate requests/connections and assert the final parent graph terminates from every node, rather than assuming a particular winner.

**Review:** the three-way test must run the moves in a `Promise.all`, assert no cycle with a CTE walk from every node, and assert the number of changed edges is at most the number of successful responses.

### Exercise 4

**Prompt:** Design a more concurrent alternative to the table lock.

**Approach:** Compare serializable transactions with retry against a carefully ordered lock set. Write the conflicting schedule and prove it cannot commit a cycle before implementing.

**Review:** the row-lock design must lock in a deterministic order (ids sorted), explain what happens when a chain changes between reading and locking (re-read under the lock), and pass the three-way test.

### Exercise 7 — ownership and authorization

Reference: read `created_by` in the same `SELECT` that checks the node exists, compare with `req.actor`, and `throw new ForbiddenError(...)` (mapped to 403) so the `catch` rolls back and releases the lock.

Review: explain why the check must sit after the lock (a concurrent delete or re-parent could change who is allowed) and what the cost of holding the lock during the check is.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/feature.test.ts](../test/feature.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The ancestor check and move were separate operations. Two simultaneous moves could each see an acceptable old tree and together create a cycle. I changed the implementation so that: Moves validate UUIDs and parent existence, lock structural changes within a transaction, check the subtree under the lock, then update. A node cannot become its own ancestor. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
