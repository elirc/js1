# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

User A creates Learning note. User B sees an empty note list and receives 404 for A's detail, edit and delete paths. An invalid body leaves the old note intact. After A logs out, the old token receives 401.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Show an explicit empty-note state after login.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a last-edited timestamp that changes only after a valid update.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Test a failed login followed by a successful login.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Move users, tokens and notes into persistent storage.

Write a short design note before coding. List the current guarantee, the stronger guarantee you want and the new failure modes the change introduces. If this requires a larger architectural change, stop at a concrete proposal and test design until you understand the prerequisite. The earlier exercises should remain understandable and runnable.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/server.js](../server/server.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Exercise 7 — 404 or 403: choose deliberately

Every owner check in `server/server.js` answers 404 `Note not found.` whether the note does not exist or belongs to someone else. Make the alternative concrete, then decide.

1. On a throwaway branch, change `PUT /api/notes/:id` so that a note that exists but is not yours answers 403 `Not your note.` (you will need a second lookup: `notes.find(n => n.id === id)` first, then the owner comparison).
2. Write a test in which user B tries to `PUT` a note id that does not exist and one that belongs to A, and record the two status codes.
3. Now play attacker: with only B's token, what can you learn about A's data from the difference between 403 and 404? Write the answer in one sentence (it is the existence of every note id you try).
4. Revert to 404 and add the test that pins the behavior: the two cases must be indistinguishable in status and body.

Acceptance: a test proving `PUT`, `GET` and `DELETE` on a foreign note and on a missing note return identical `{ status, data }`.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
