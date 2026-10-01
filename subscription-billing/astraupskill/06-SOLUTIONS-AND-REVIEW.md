# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. A row lock and transaction commit the status and activity together; count and page rows use one repeatable-read snapshot. Currency inputs accept cent increments in the browser.

The key model is: The main record represents a customer subscription, plan category, renewal date and billing amount. Shared fields include id, title, owner, category, status, priority, amount, dueDate and notes. Statuses are Trial, Active, Past Due, Cancelled. Categories are Starter, Growth, Enterprise, Internal. Activities reference the record ID. PostgreSQL stores records and activities; API mappers convert snake_case columns to camelCase JSON.

The worked fixture should behave as follows: Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Trial to Active, then repeat Active: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

## Extension solutions

### Exercise 1

**Prompt:** Add a visible due-soon filter with a precisely defined date window.

**Approach:** Compare valid calendar labels against today and a documented inclusive end date; preserve other filters and reset or clamp pagination.

**Review:** the window must be computed in SQL inside the same `REPEATABLE READ READ ONLY` transaction as the count (add it to the `where` string with a parameter), both ends stated as inclusive or exclusive, and a record due exactly on the end date tested; `total` and the page clamp must reflect the filtered rows, which means the filter runs in the `COUNT(*)` query too.

### Exercise 2

**Prompt:** Add a reason to an actual status transition.

**Approach:** Validate a bounded reason and save it with the transition event. A same-value command should not invent another transition.

**Review:** the reason must be stored on the `status` activity row only (a new nullable `reason` column or the `body`), written by the same `INSERT` inside `withTransaction`; a repeat with the same status must still return early without writing; a blank reason must be rejected with 400 before `BEGIN`; and your test must reuse the trigger technique from the fourth test to prove that a failed reason insert rolls the status back.

### Exercise 3

**Prompt:** Test deletion of the final row on a filtered last page.

**Approach:** Create three matching records with size two, delete the last row and request the old page. Assert both the returned page number and matching IDs.

**Review:** after deleting the only row on page 2 of a filtered list, requesting page 2 again must clamp to page 1 with `total` 2 and the remaining ids; a filter that matches nothing must return `total` 0 and `page` 1; assert on ids, and note that the count and the rows come from one snapshot transaction, so a concurrent insert cannot make them disagree.

### Exercise 4

**Prompt:** Design conflict detection for two people editing the same full record.

**Approach:** Return a version number and require the expected version on update. Reject stale writes with a clear conflict response; keep the learner draft available for comparison. Row locking alone does not detect an edit based on an old screen.

**Review:** the check must be part of the `UPDATE` itself, `UPDATE items SET ... WHERE id=$1 AND updated_at=$2 RETURNING *`, run under `FOR UPDATE` or as a single statement; zero rows updated means 409 and no activity row; your test sends two sequential `PUT`s with the same stale `updatedAt` and asserts 200 then 409 with the stored record equal to the first result.

### Exercise 7 — ownership and authorization

Reference implementation (the important part is that the ownership check happens on the locked row, inside the same transaction as the write):

```typescript
class ForbiddenError extends Error {}
app.use((req, _res, next) => { (req as any).actor = String(req.get("X-Actor") ?? "").trim(); next(); });
function requireActor(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!(req as any).actor) return res.status(401).json({ error: "Sign in to change records." });
  next();
}
// inside the PATCH transaction, right after the FOR UPDATE select:
if (current.rows[0].owner !== (req as any).actor) throw new ForbiddenError("Only the owner can change this subscription.");
// error middleware:
if (error instanceof ForbiddenError) return res.status(403).json({ error: error.message });
```

Reference test (after adding `headers: Record<string, string> = {}` to `request()` and spreading it into the fetch headers):

```typescript
test("only the owner can change a subscription", async () => {
  const mine = { "X-Actor": "Junior Learner" }, other = { "X-Actor": "Someone Else" };
  const made = await call(route, "POST", valid, mine);
  const path = route + "/" + made.data.id;
  assert.equal((await call(path, "PUT", { ...valid, title: "Hijacked" }, other)).status, 403);
  assert.deepEqual((await call(path)).data, made.data);
  assert.equal((await call(path + "/status", "PATCH", { status: "Active" }, other)).status, 403);
  assert.equal((await call(path + "/activity")).data.length, 1);
  assert.equal((await call(path + "/status", "PATCH", { status: "Active" }, mine)).status, 200);
  assert.equal((await call(path, "PUT", valid)).status, 401);
});
```

Review: the 403 must come from inside `withTransaction` so the lock is released by the rollback; `POST` must ignore a body `owner`; explain why the check is on `current.rows[0].owner` (the locked, committed value) and not on whatever the client sent.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/workflow.test.ts](../test/workflow.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Loose values could reach string operations or SQL, page requests could land beyond the result set, and repeated status commands created misleading history. I changed the implementation so that: Required text, money and calendar dates are validated; list pages have stable ID tie-breaking and clamp to available pages. Repeating a status leaves timestamps and history alone. A row lock and transaction commit the status and activity together; count and page rows use one repeatable-read snapshot. Currency inputs accept cent increments in the browser. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
