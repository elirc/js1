# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Create a synthetic record with amount 12.50 and dueDate 2028-02-29. Change Trial to Active, then repeat Active: only one status activity should exist. Request page 999 after creating three matching rows with pageSize 2: the last page contains one row. Reject an impossible date and verify the old record is unchanged.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Add a visible due-soon filter with a precisely defined date window.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a reason to an actual status transition.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Test deletion of the final row on a filtered last page.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Design conflict detection for two people editing the same full record.

Write a short design note before coding. List the current guarantee, the stronger guarantee you want and the new failure modes the change introduces. If this requires a larger architectural change, stop at a concrete proposal and test design until you understand the prerequisite. The earlier exercises should remain understandable and runnable.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/src/index.ts](../server/src/index.ts) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Exercise 7 — ownership and authorization

Every subscription row has an `owner` column, but any browser can edit any row. Add an actor and enforce ownership inside the transaction.

1. Read the caller identity from an `X-Actor` header in a small middleware and attach it as `req.actor`; a blank header on `POST`, `PUT`, `PATCH` or `DELETE` answers 401 `{ error: "Sign in to change records." }`. `GET` stays open.
2. In the PUT, PATCH and DELETE handlers, after `SELECT ... FOR UPDATE` (add that select to PUT and DELETE, which currently update blind), compare `row.owner` with `req.actor`; on mismatch throw a new `ForbiddenError` that the error middleware maps to 403, so the transaction rolls back with nothing written.
3. On `POST`, overwrite `owner` with `req.actor` before the `INSERT`.
4. Send the header from `client/src/api.ts` using a small "signed in as" input.

Acceptance, written before coding: cross-owner `PUT` is 403 and the row deep-equals the original; cross-owner `PATCH /status` is 403 with no new activity row; owner `PATCH` is 200; missing header is 401. Extend `request()` in `test/database.ts` with a `headers` parameter to write the test.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
