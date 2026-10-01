# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Actual changes update the in-memory record and append one status event. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

The key model is: This app represents a project risk and its mitigation owner. A record uses generic fields id, title, owner, category, status, priority, amount, dueDate and notes. Categories are Schedule, Budget, Security, Vendor. Statuses are Identified, Mitigating, Accepted, Closed. The UI gives these shared fields domain-specific labels. Mitigation review date is represented as a YYYY-MM-DD calendar string, not an instant. A repository array and its activity collection live only in the Node process. Restarting the server restores seeds; this change does not add durable storage.

The worked fixture should behave as follows: The worked fixture is defined once in [chapter 3](03-WORKED-CHANGE.md#predict-this-example); use those exact values here.

## Extension solutions

### Exercise 1

**Prompt:** Create a probability-impact score

**Approach:** Define bounded independent scales and derive the score; do not reuse the generic amount field without changing its meaning explicitly.

**Review:** the score must be computed in `query()` before sorting and never stored; the test must show a changed impact changes the score and that ties fall back to id.

### Exercise 2

**Prompt:** Add a UI confirmation for changing Mitigating back to Identified.

**Approach:** Cancellation must preserve state and history. Confirmation calls the existing status endpoint; keep server validation and repeat-safe handling because API callers can bypass the dialog.

**Review:** the confirmation must gate the client request; the server no-op guard must be exercised by a repeated confirm and produce one entry.

### Exercise 3

**Prompt:** Add a regression for a mitigation review date at a leap-year boundary.

**Approach:** Use 2028-02-29 as valid and 2027-02-29 as invalid. Assert the valid string survives a read and the rejected edit leaves the old record unchanged; do not test only error wording.

**Review:** the regression must include a valid and an invalid leap day and assert an unchanged record after the 400.

### Exercise 4

**Prompt:** Record formal risk acceptance

**Approach:** Add an acceptance decision record with actor and rationale; the Accepted label currently does not enforce approval authority.

**Review:** acceptance must be idempotent (one entry for two calls), validated before any write, and the status change and the entry must happen in the same synchronous step.

### Exercise 7 — swap the storage behind the same interface

Reference shape for `setStatus` over `node:sqlite`:

```js
setStatus(id, status) {
  return tx(() => {
    const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
    if (!existing) return null;
    if (existing.status === status) return existing;
    db.prepare("UPDATE items SET status = ?, updatedAt = ? WHERE id = ?").run(status, now(), id);
    db.prepare("INSERT INTO activity (id, itemId, kind, body, createdAt) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), id, "status", `Changed status from ${existing.status} to ${status}`, now());
    return db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  });
}
```

Review: the interface is the contract; the tests are the proof that the contract held. Explain which guarantee you had for free with the array (no interleaving) and which mechanism replaced it (the transaction).

### Exercise 8 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `custodian` stamped in `create`, and a comparison before `setStatus`/`update`/`remove` mutate the arrays. Extend `request()` in `test/http.js` with a headers argument.

Review: the comparison must precede the mutation and the activity write.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/workflow.test.js](../test/workflow.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Status requests could add redundant history. Validation accepted malformed shapes, and page calculations lacked a consistent clamped result. I changed the implementation so that: Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Actual changes update the in-memory record and append one status event. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
