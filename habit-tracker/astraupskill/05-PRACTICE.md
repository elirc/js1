# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Change the badge from `Best: 3 days` to `Best: 3 days (Feb 28 - Mar 1)`.

The output is the `.best-streak` span built at `app.js:142-144`. The input is the same
`habit.history` object `bestStreak` already reads. Write the acceptance example before you edit:
with `{'2024-02-28':true,'2024-02-29':true,'2024-03-01':true,'2024-03-03':true}` and
`today = '2024-03-03'`, the badge must read `Best: 3 days (Feb 28 - Mar 1)` - note that the run
crosses a month *and* a leap day, which is why this fixture is the right one.

The trap: it is tempting to loop over `habit.history` a second time in `render` to find the
range. Do not. `bestStreak` already filters four kinds of bad key at `app.js:210-214` and sorts
by pinned-UTC ordinal at `app.js:215`; a second loop will forget one of those rules within a
month. Return the range from `bestStreak` (or export the filtered ordinal array) and convert
ordinals back to labels with `new Date(ordinal * 86400000).toISOString().slice(0, 10)`.

Then decide the tie case and write your decision in a comment: with two separate three-day runs,
which one does the badge show? Add a regression for it - the delivered suite has no tie fixture.

## Exercise 2 — independent variation

Extend the visible grid from 7 days to 30 without breaking the two percentages.

Close chapter 3 while you implement. `WEEK_LENGTH` is declared once (`app.js:2`) and read in
three places that mean three different things: the width of the grid (`lastNDays(WEEK_LENGTH)`,
`app.js:128`), the denominator of the per-habit figure `${done}/${WEEK_LENGTH} days this week`
(`app.js:164-167`), and the denominator of the overall figure
`state.habits.length * WEEK_LENGTH` (`app.js:187-188`). Bump the constant and you get a grid of
30 cells labelled "days this week", which is wrong in words rather than in arithmetic - the kind
of bug that ships.

Write your design in three sentences before touching anything: which of those three uses is the
*window* and which is the *reporting period*, what you will name the second constant, and what
observation proves the two are now independent. The invariant to preserve: `currentStreak`
(`app.js:197-207`) and `bestStreak` (`app.js:209-222`) read `habit.history`, never the rendered
grid, so both numbers must be byte-identical before and after your change. Assert that.

## Exercise 3 — failure-focused extension

Write a test that survives the autumn daylight-saving transition, then break `bestStreak` on
purpose and make sure your test catches it.

In America/New_York, 2024-11-03 is a 25-hour local day. Build a fixture with
`{'2024-11-02':true,'2024-11-03':true,'2024-11-04':true}` and call
`bestStreak(habit, '2024-11-04')`; it must return 3. Now prove your test is worth having:
temporarily replace the ordinal line at `app.js:215` with one that subtracts local midnights,
e.g. `.map(([date]) => new Date(date).setHours(0,0,0,0) / 86400000)`, and confirm the test
**fails**. Restore the line afterwards. A test you have never seen fail is not evidence.

Then do the failure half properly. `toggleDay` (`app.js:79-92`) reassigns `state.habits` and
*then* calls `saveHabits()` at `app.js:90`, and `saveHabits` (`app.js:46-48`) has no `try`. Stub
`Storage.prototype.setItem` to throw, click a day cell, and record what happens: the exception
escapes the click handler, the DOM is never re-rendered, and `state.habits` now disagrees with
what is on disk - reload and the check-in is gone with no message. Capture the state before and
after, then close the gap the way `JS1/flashcards/app.js:246-258` does: build the candidate,
write it, and only then publish and render. The caller needs feedback, not just an exception in
the console.

## Exercise 4 — stretch design

Schedule a refresh at **local** midnight without assuming a day is 24 hours, and prove it
survives a DST transition.

Write the design note before coding. The current guarantee is weak and worth stating precisely:
`lastNDays(WEEK_LENGTH)` is evaluated once per `render()` call (`app.js:128`), and nothing calls
`render()` on a timer, so a tab left open overnight keeps yesterday's seven columns and keeps
calling *yesterday* today - clicking the rightmost cell writes the wrong date.

The stronger guarantee: the grid and both streak numbers reflect the current local date within
seconds of local midnight. Your note must reject the obvious implementation and say why:
`setInterval(render, 24 * 60 * 60 * 1000)` drifts on the two DST days of the year (23 and 25
hours), drifts further every time the browser throttles background timers, and does not fire at
all across a laptop sleep. Specify instead: compute the delay to the next local midnight from
the clock each time (`startOfToday()` at `app.js:233-237` plus one day, minus `Date.now()`), use
`setTimeout`, and re-arm inside the callback so each wait is recomputed. Add a
`visibilitychange` listener as a backstop for the sleep case - `JS1/pantry-inventory/app.js:183`
in this same batch does exactly that, and its own review notes that the listener shipped with no
test, so write one.

List the new failure modes you are introducing: a full `render()` replaces every DOM node, so
keyboard focus and any open edit form are lost at midnight; and a listener registered at module
scope is never removed, which matters the moment this file becomes a component. Stop at the note
plus a test plan - a test that stubs `startOfToday` to return a date one day later, dispatches
`visibilitychange`, and asserts the rightmost cell's `aria-label` changed.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [app.js](../app.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
