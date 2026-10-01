# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Tags Utility,utility, EVENTS,events become Utility and EVENTS. A failed title-edit write leaves saved and in-memory titles unchanged. Clipboard rejection resolves false instead of producing an unhandled rejection.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Return defensive read copies.

Start by locating the current input, handler and output. Write an acceptance example before editing. Make one small change, run the focused tests, and demonstrate it through the same public UI/API a user would use. Add one meaningful regression if the behavior can break in a way the existing suite would miss.

## Exercise 2 — independent variation

Add a normalized tag filter.

Close the worked-change chapter while implementing. Describe your design in three sentences: the data you will add or reuse, the rule it must preserve, and the observation that proves it. Compare your answer with the solution only after an independent attempt. If you get stuck, request a hint about the next boundary rather than a complete implementation.

## Exercise 3 — failure-focused extension

Make the write fail on the **second** save and prove the first snippet survived a reload.

The delivered test replaces `localStorage.setItem` with a function that always throws. Write a
sharper one: a counter that lets the first call through to the real `Map`-backed setter and
throws on the second.

Save snippet A (succeeds). Save snippet B (fails). Then capture and assert all four:

1. `store.listSnippets()` contains A and not B;
2. `data.get("js1-snippet-vault")` - the serialized bytes - contains A's title and not B's,
   compared as a string;
3. the thrown error is **not** user-facing (`store.isUserFacingError(error) === false`), because
   `"quota"` is not a sentence to show a person - `main.js:52-61` substitutes its own;
4. re-import the module against those same stored bytes
   (`await import("../src/store.js?case=" + randomUUID())` with the same fake storage) and assert
   A is still there. **A reload is the only thing that distinguishes "written" from "shown"**,
   and the module-level `snippets` array lies to you until you do it. That re-import trick is
   already in `fixture()` at the top of the test file; this is what it is for.

Then restore the setter, save B again, and assert there is exactly **one** B - not two. The
failed attempt never reached `snippets = next` (`store.js:33`), so there is no half-applied state
to duplicate. Reverse the two lines in `commit` and watch this assertion fail; that is the
regression the change exists to prevent.

Recovery behaviour, not an exception, is what you are grading yourself on: after the failure the
user's typing is still in the form, because `handleSubmit` returns before `resetForm()`
(`main.js:63-65`).

## Exercise 4 — stretch design

Add a tag-rename operation, and decide whether it is case-preserving.

This one is small enough to implement and it forces the question the tag code has been dodging.
`parseTags` (`store.js:36-44`) keys on `toLowerCase()` but stores the **first spelling seen**, so
your library can contain `Utility` on one snippet and `UTILITY` on another - they are the same
tag for comparison and two different strings on screen.

Write the design note first; it is four questions and each has a defensible answer:

1. **What does `renameTag("utility", "helpers")` match?** Every tag whose key equals `utility`,
   presumably - which means the match is case-insensitive even though the stored values are not.
   Say so explicitly, because the caller passing `"Utility"` will expect the same result.
2. **What casing does the result have?** The new name exactly as typed, on every snippet? Or the
   first spelling already present, preserving what each snippet "chose"? The first is predictable;
   the second is nobody's intent.
3. **What if the target name already exists on a snippet?** `["Utility", "Helpers"]` renamed to
   `Helpers` must produce `["Helpers"]`, not `["Helpers", "Helpers"]`. Reuse `parseTags` on the
   result rather than writing a second de-duplication rule - two copies of that rule will drift.
4. **Is it one write or many?** It must be one: build the whole replacement array and hand it to
   `commit` (`store.js:31-34`) once. A loop that commits per snippet can fail halfway and leave
   the library half-renamed, which is the exact failure mode this project's write-then-publish
   design exists to make impossible.

Then implement it in `store.js` - it has no DOM dependency, so it is testable with the existing
`fixture()`. Tests: an ordinary rename across two snippets, a rename that collides, a rename
where the old tag does not exist (no write at all - assert the bytes are unchanged), and a
rename whose `setItem` throws (nothing published, and the throw is not user-facing).

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [src/store.js](../src/store.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
