# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Ada owns Ada@Example.com. Creating Other with " ada@example.COM " fails. Editing Ada’s phone while keeping Ada@Example.com succeeds. Changing Bob’s email to ADA@example.com fails.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Clear the duplicate message when the user corrects the address, without hiding unrelated errors.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a case-insensitive company filter without mutating stored company names.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Implement a duplicate-review screen for legacy contacts already sharing an email.

Create a failing example in a disposable fixture. Capture the state before the operation and after the failure. Identify what must remain unchanged and what feedback the caller needs. A correct result includes understandable recovery behavior, not just throwing an exception.

## Exercise 4 — stretch design

Design the corresponding server-side uniqueness constraint.

Write a short design note before coding. List the current guarantee, the stronger guarantee you want and the new failure modes the change introduces. If this requires a larger architectural change, stop at a concrete proposal and test design until you understand the prerequisite. The earlier exercises should remain understandable and runnable.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [app.js](../app.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
