# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. The synchronous in-memory repository changes a record and appends history together within one process.

The key model is: The main record represents a case owner, case category, due date and amount. Shared fields include id, title, owner, category, status, priority, amount, dueDate and notes. Statuses are Intake, Discovery, Negotiation, Closed. Categories are Contract, Employment, Real Estate, Compliance. Activities reference the record ID. Records and activities live in JavaScript arrays and reset when the API process restarts.

The worked fixture should behave as follows: Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Intake to Discovery, then repeat Discovery: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

## Extension solutions

### Exercise 1

**Prompt:** Add a visible due-soon filter with a precisely defined date window.

**Approach:** Compare valid calendar labels against today and a documented inclusive end date; preserve other filters and reset or clamp pagination.

**Review:** your acceptance example must state whether the window is computed on the server from a query parameter or on the client, and whether both ends are inclusive; test a record due exactly on the boundary day; and show that `total` and page clamping still count only the filtered rows (the filter must run inside `query()` before `total` is computed, not after the slice).

### Exercise 2

**Prompt:** Add a reason to an actual status transition.

**Approach:** Validate a bounded reason and save it with the transition event. A same-value command should not invent another transition.

**Review:** the reason must be stored on the `status` activity entry only, never on the record; a repeat with the same status must write nothing (no entry, no `updatedAt` change) even when a reason is supplied; a blank reason must be rejected with 400 without changing the status; and you must decide, and document, whether a `PUT` that changes `status` still bypasses the reason rule.

### Exercise 3

**Prompt:** Test deletion of the final row on a filtered last page.

**Approach:** Create three matching records with size two, delete the last row and request the old page. Assert both the returned page number and matching IDs.

**Review:** after deleting the only row on page 2 of a filtered list, requesting page 2 again must clamp to page 1 with the remaining rows and `total` 2; a filter that now matches nothing must return `total` 0 and `page` 1 with an empty `items`; assert on the ids returned, not only on `items.length`.

### Exercise 4

**Prompt:** Design conflict detection for two people editing the same full record.

**Approach:** Return a version number and require the expected version on update. Reject stale writes with a clear conflict response; keep the learner draft available for comparison. Row locking alone does not detect an edit based on an old screen.

**Review:** the check must live in `update()` before `items = items.map(...)`, comparing a client-supplied `updatedAt` (or a new `version` counter) with the stored one; a mismatch answers 409 without mutating the record or adding activity; your test must send two sequential `PUT`s with the same stale value and assert the second is 409 and the stored record equals the first result.

### Exercise 7 — ownership and authorization

Reference implementation (keep it small; the point is where the check lives, not the header format):

```javascript
// server/server.js, after app.use(express.json())
app.use((req, _res, next) => {
  req.actor = String(req.get("X-Actor") || "").trim();
  next();
});
function requireActor(req, res, next) {
  if (!req.actor) return res.status(401).json({ error: "Sign in to change records." });
  next();
}
function requireOwner(req, res, next) {
  const existing = repository.find(req.params.id);
  if (!existing) return res.status(404).json({ error: "CaseFile not found." });
  if (existing.owner !== req.actor)
    return res.status(403).json({ error: "Only the owner can change this case." });
  next();
}
app.post("/api/cases", requireActor, validateItem, (req, res) =>
  res.status(201).json(repository.create({ ...req.body, owner: req.actor })),
);
app.put("/api/cases/:id", requireActor, requireOwner, validateItem, (req, res) =>
  res.json(repository.update(req.params.id, req.body)),
);
app.patch("/api/cases/:id/status", requireActor, requireOwner, (req, res) => { /* unchanged body */ });
app.delete("/api/cases/:id", requireActor, requireOwner, (req, res) => { /* unchanged body */ });
```

Reference test (after adding a `headers = {}` parameter to `request()` in `test/http.js` and spreading it into `fetch`'s headers):

```javascript
test("only the owner can change a case", async () => {
  const mine = { "X-Actor": "Junior Learner" }, other = { "X-Actor": "Someone Else" };
  const made = await call(route, "POST", valid, mine);
  const path = route + "/" + made.data.id;
  assert.equal((await call(path, "PUT", { ...valid, title: "Hijacked" }, other)).status, 403);
  assert.deepEqual((await call(path)).data, made.data);
  assert.equal((await call(path + "/status", "PATCH", { status: "Discovery" }, other)).status, 403);
  assert.equal((await call(path + "/activity")).data.filter((x) => x.kind === "status").length, 0);
  assert.equal((await call(path + "/status", "PATCH", { status: "Discovery" }, mine)).status, 200);
  assert.equal((await call(path, "PUT", { ...valid })).status, 401);
});
```

Review: the 403 must be decided before any repository call, and `POST` must overwrite `owner` from the header (a body `owner` of someone else is not an error, it is simply ignored). Explain why 403, not 404, is the right answer here, and when a 404 would leak less information.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/workflow.test.js](../test/workflow.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Loose values could reach string operations or SQL, page requests could land beyond the result set, and repeated status commands created misleading history. I changed the implementation so that: Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. The synchronous in-memory repository changes a record and appends history together within one process. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
