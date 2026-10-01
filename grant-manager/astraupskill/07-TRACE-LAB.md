# Trace lab: atomic status transitions, consistent pages and calendar dates

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Prepare a prediction

Open [server/src/index.ts](../server/src/index.ts) and [test/workflow.test.ts](../test/workflow.test.ts) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Create "Community learning grant proposal" in Education with status Draft, amount 12.50 and dueDate 2028-02-29. Request Submitted twice: one status event is added. An edit with dueDate 2027-02-29 returns 400 and preserves the old record. With three matching records and pageSize 2, page 999 clamps to page 2 with one item. A forced activity-insert failure leaves both the record and its prior history unchanged.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Expected observations

| Action or input | Expected result |
|---|---|
| Draft to Submitted | One new status event |
| Submitted to Submitted | No new status event |
| Invalid calendar-date edit | 400; old record unchanged |
| 3 matches, size 2, page 999 | Page 2, one item |
| Empty matching set | Page 1, total zero |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Follow one concrete command: change "Community learning grant proposal" from Draft to Submitted. The first successful command represents a real transition and adds one status event. Sending Submitted again compares equal to current state, so it returns the record without adding another status event. Created, updated and note entries remain separate kinds; counting every timeline row would give the wrong assertion. This guarantee concerns repeated current values, not global request deduplication. After an intervening transition, requesting Submitted can legitimately create a new event.

The handler obtains one database client, begins a transaction and reads the record FOR UPDATE. A second writer waits for that row, then compares against its latest committed status. The update and activity insert use the same client, so an audit-insert failure rolls back the status too. The test installs a temporary trigger to force that late failure. Separately, the list transaction counts and fetches under one repeatable-read snapshot. It does not freeze the dataset across later HTTP requests. PostgreSQL DATE values are returned as calendar strings through a type parser, avoiding accidental local-midnight conversion.

Validation belongs at the API boundary even when the React controls constrain input. An object is not a valid title, an unknown priority is not silently accepted, and 2027-02-29 is not a real date. Normalization may trim a valid string, but should not stringify an object into a misleading title. For paging, count matching rows before clamping a request such as page 999. Sort by the selected field and then id so ties are deterministic on an unchanged dataset. The scaffold accepts its named statuses; it does not enforce a domain approval graph or actor permissions. A Draft-to-Submitted label change alone does not implement every real-world rule for a grant application and its owner.

Pause near `app.patch("/api/grants/:id/status"` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.

## Concurrency and rollback schedule

| Step | Request A | Request B |
|---|---|---|
| 1 | Begins and locks the record | Begins, waits for the row |
| 2 | Reads old status, writes new status and event | Still waiting |
| 3 | Commits | Acquires lock and reads committed status |
| 4 | Returns changed record | Same-value guard skips another event |

The two Promise.all requests in the regression do not require A to win. They require the same invariant whichever connection gets the lock first. All related writes use the transaction client. Using the global pool for the event insert would move that write outside the transaction and break the guarantee.

The final test installs a trigger that rejects status activity inserts. The status UPDATE executes first; the later insert fails. ROLLBACK restores the previous status and timestamp. The following successful request proves that the failure did not leave the operation permanently unusable. Compare record and history after failure: a 500 response alone cannot prove rollback.

The seed dueDate mapping and PostgreSQL DATE parser address representation, separately from concurrency. A JSON field named dueDate does not automatically populate a SQL record field named due_date. Follow the explicit mapping and verify the resulting label at the API and date input. Calendar labels differ from the timestamps used for activity chronology.

## Manual HTTP example

Start the local development server using the course index. This example creates a synthetic record in that learning instance. Use the port printed by your server if you override its default. Automated tests use their own ephemeral port instead.

```powershell
$api = 'http://localhost:4231'
$body = '{"title": "Community learning grant proposal", "owner": "Junior Learner", "category": "Education", "status": "Draft", "priority": "Medium", "amount": 12.5, "dueDate": "2028-02-29", "notes": "Synthetic trace-lab fixture"}'
$record = Invoke-RestMethod -Uri "$api/api/grants" -Method Post -ContentType 'application/json' -Body $body
$change = @{ status = 'Submitted' } | ConvertTo-Json
Invoke-RestMethod -Uri "$api/api/grants/$($record.id)/status" -Method Patch -ContentType 'application/json' -Body $change
Invoke-RestMethod -Uri "$api/api/grants/$($record.id)/status" -Method Patch -ContentType 'application/json' -Body $change
$history = Invoke-RestMethod -Uri "$api/api/grants/$($record.id)/activity"
@($history | Where-Object { $_.kind -eq 'status' }).Count
```

Expected final count: 1. The created entry remains present but is excluded by the kind filter. Edit the dueDate to the impossible 2027-02-29 in a separate request and verify rejection without a changed record. Remove the synthetic record through the app after the exercise if you want to restore your learning dataset.


## Connect the trace to executable evidence

The actual regression scenarios are:

- valid records round-trip and malformed edits leave the stored record intact
- equal sort keys give stable pages and an out-of-range page retains real totals
- repeated status requests produce one history entry for the actual change
- a failed activity insert rolls back the status update

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
