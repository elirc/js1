# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Status requests could add redundant history. Validation accepted malformed shapes, and page calculations lacked a consistent clamped result. Separate status and history writes could disagree after a late failure; separate count/page queries could see different snapshots. Seed dueDate values also needed correct JSON-to-SQL field mapping.

**After:** Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Status and audit writes use one row-locked transaction; count and rows share a repeatable-read snapshot. Seed dates map to the intended column. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

## Predict this example

Create "Annual monitoring software agreement" in SaaS with status Draft, amount 12.50 and dueDate 2028-02-29. Request Legal Review twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item. A forced activity-insert failure leaves both the record and its prior history unchanged.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/src/index.ts](../server/src/index.ts) near line 107. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
app.patch("/api/contracts/:id/status", asyncRoute(async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw new ValidationError("Choose a valid status.");
    const updated = await withTransaction(async client => {
      const current = await client.query<ItemRow>("SELECT * FROM items WHERE id=$1 FOR UPDATE",[req.params.id]);
      if (!current.rows[0]) return null;
      if (current.rows[0].status === status) return current.rows[0];
      const result = await client.query<ItemRow>("UPDATE items SET status=$1, updated_at=now() WHERE id=$2 RETURNING *",[status,req.params.id]);
      await client.query("INSERT INTO activity_entries (item_id,kind,body) VALUES ($1,'status',$2)",
        [req.params.id,"Changed status from " + current.rows[0].status + " to " + status]);
      return result.rows[0]!;
    });
    if (!updated) return res.status(404).json({ error: "Record not found." });
    res.json(toItem(updated));
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

Follow one concrete command: change "Annual monitoring software agreement" from Draft to Legal Review. The first successful command represents a real transition and adds one status event. Sending Legal Review again compares equal to current state, so it returns the record without adding another status event. Created, updated and note entries remain separate kinds; counting every timeline row would give the wrong assertion. This guarantee concerns repeated current values, not global request deduplication. After an intervening transition, requesting Legal Review can legitimately create a new event.

The handler obtains one database client, begins a transaction and reads the record FOR UPDATE. A second writer waits for that row, then compares against its latest committed status. The update and activity insert use the same client, so an audit-insert failure rolls back the status too. The test installs a temporary trigger to force that late failure. Separately, the list transaction counts and fetches under one repeatable-read snapshot. It does not freeze the dataset across later HTTP requests. PostgreSQL DATE values are returned as calendar strings through a type parser, avoiding accidental local-midnight conversion.

Validation belongs at the API boundary even when the React controls constrain input. An object is not a valid title, an unknown priority is not silently accepted, and 2027-02-29 is not a real date. Normalization may trim a valid string, but should not stringify an object into a misleading title. For paging, count matching rows before clamping a request such as page 999. Sort by the selected field and then id so ties are deterministic on an unchanged dataset. The scaffold accepts its named statuses; it does not enforce a domain approval graph or actor permissions. A Draft-to-Legal Review label change alone does not implement every real-world rule for a vendor contract and its responsible owner.

## Three variations to work through

- **Normal variation:** change one ordinary value in the successful fixture while preserving its shape. Predict which fields should change and which should remain identical. Execute it and explain any difference.

- **Invalid variation:** use the invalid case from the tests. Predict the error and the exact number of writes that should happen. Compare the state before and after; error text alone does not prove data integrity.

- **Boundary variation:** repeat the action, reload, delay a callback or force a late write failure as appropriate to this lesson. Explain why the boundary differs from the happy path. The test file below contains a concrete example you can adapt rather than inventing an unrealistic failure.

## Executable examples

These are the actual regression tests in [test/workflow.test.ts](../test/workflow.test.ts). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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
const route = "/api/contracts",
  statuses = ["Draft", "Legal Review", "Active", "Renewal", "Expired"];
const valid = {
  title: "A lesson record",
  owner: "Junior Learner",
  category: "SaaS",
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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
