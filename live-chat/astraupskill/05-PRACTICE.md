# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Connect to study, wait for presence, send malformed JSON, null, and an object-valued author, then send Trace this insert. The valid message broadcasts and appears once in HTTP history. Creating study twice returns 409.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Show a sending/error state for a message draft.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a room rename endpoint without changing the room ID or slug.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Test two rooms to ensure broadcasts do not cross subscriptions.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Design acknowledged delivery and reconnect replay.

Write a short design note before coding. List the current guarantee, the stronger guarantee you want and the new failure modes the change introduces. If this requires a larger architectural change, stop at a concrete proposal and test design until you understand the prerequisite. The earlier exercises should remain understandable and runnable.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [server/src/index.ts](../server/src/index.ts) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Exercise 7 — ownership and authorization

Any socket can post under any `author`, and any HTTP client can create rooms. Bind identity to the connection instead of trusting the frame.

1. Add a `POST /api/sessions` route that takes `{ name }` (2-40 characters) and returns an opaque token; keep sessions in a `Map` for now.
2. Require `?token=` on the WebSocket URL: in `connectSocket`, resolve the session before joining and close with `4401` when it is missing or unknown. Take `author` from the session, and ignore `event.author` entirely.
3. Add `created_by` to `rooms` (`server/db/schema.sql`) and set it from the session on `POST /api/rooms` (which must now require `Authorization: Bearer <token>` and answer 401 otherwise). Only the creator may rename a room in exercise 2.

Acceptance, written first: a frame with a spoofed `author` is stored under the session's name; a socket without a token is closed with 4401 and nothing is stored; room creation without a token is 401; a rename by a non-creator is 403 and the row is unchanged.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
