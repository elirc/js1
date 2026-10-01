# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

JS contains a unknown and b known; CSS contains c unknown. Select JS and unlearned-only: the session contains just a. Reveal and mark it known: progress becomes Completed 1 of 1 and grading is disabled. Restarting now finds no eligible cards. A rejected write instead keeps a at index zero.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Add a **Restart** button next to `#shuffle-button` (`index.html:77`) that replays the current
session in its original order, without reshuffling and without recomputing eligibility.

The handler is one line, but the acceptance example is the exercise. Write it first: study deck
`JS` with "unlearned only" ticked and two unknown cards; grade both `known`; click Restart.
`state.studyOrder` must still have length 2 and the same two ids in the same order, and
`state.studyIndex` must be back to 0. Now try the obvious implementation - calling
`startStudy(false)` - and watch it produce an order of length 0, because `startStudy`
re-filters through `state.unlearnedOnly` at `app.js:223` and both cards are now known. That is
the difference between replaying a snapshot and rebuilding a filter, and it is the whole lesson
of this course in four lines of code. Add a regression asserting the order length after
restart; the delivered suite would not catch this.

## Exercise 2 — independent variation

Show "3 of 5 correct this session" in `#study-summary` (`index.html:78`) - grades made *in this
session only*, not the persistent `known` flags.

Close chapter 3 while you implement. Before you write code, answer three questions in writing:
where does the per-session tally live (a new field on `state`, reset in `startStudy` at
`app.js:222-230`), what resets it (starting a session, and changing the deck filter, which now
also starts a session at `app.js:53-57`), and what must *not* change it (a card that was already
`known` before the session began, and a grade whose `localStorage.setItem` threw). The trap is
that `renderStudy` already computes a count at `app.js:284-288` by looking up `known` on each
id in `state.studyOrder` - reusing that number is the naive answer and it counts card `b`'s
pre-existing `known: true` as a correct answer you never gave. Prove the difference with a
fixture where one card starts `known`.

## Exercise 3 — failure-focused extension

Make the *second* grade of a session fail, and prove the first grade survived a reload.

The delivered test (`test/study.test.cjs`, second block) stubs `Storage.prototype.setItem` to
throw for every call. Write a sharper one: a counting stub that succeeds once and throws on the
second call. Study two unknown JS cards. Grade the first (`known`), grade the second (it
fails), then read `app.w.localStorage.getItem('js1-flashcards')` directly and assert the first
card's `known` is `true` in the *persisted bytes* while the second's is still `false`, that
`state.studyIndex` is 1 rather than 2, and that `#study-summary` contains "Could not save".
Finally restore `setItem`, re-open the app against those same stored bytes, and assert the
first grade is still there - a reload is the only thing that distinguishes "written" from
"shown". Recovery behavior, not an exception, is what you are grading yourself on: the card is
still revealed (`state.flipped` stays `true`), so retrying is one click.

## Exercise 4 — stretch design

Design spaced repetition on top of this schema, and write the migration for the records that
already exist.

Stop at a design note plus a test plan; do not implement it. The current schema is
`{ id, deck, front, back, known }` (see `starterCards` at `app.js:3-7`) and the current
guarantee is binary: a card is known or it is not. The stronger guarantee you want is "a card
becomes eligible again after an interval that depends on its grade history". Your note must
answer, in concrete terms: (1) where the schedule lives - a `dueAt` string on the card, or a
separate `history` array keyed by id, and what that does to `JSON.stringify` size in
`localStorage`; (2) what `loadCards` (`app.js:81-84`) does with the records already on disk that
have no schedule at all - pick a rule and write it as one sentence a reviewer could implement;
(3) what a session snapshot means once eligibility depends on the clock, since `startStudy`
filters once at `app.js:223` and a long session could cross midnight. Name the new failure
mode you are introducing: a clock change or a timezone shift can make a card due or not due
between two renders. The earlier exercises must still run after your note; nothing here changes
code.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [app.js](../app.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
