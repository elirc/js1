# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

On September 8, an item expiring September 7 with quantity five and minimum one is Stock OK and Expired. An item expiring today with quantity one and minimum one is Low stock and not expired. Only a future sufficiently stocked item matches the combined view.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Add an "Expiring soon" filter for items expiring within the next seven days.

The input is a fourth `<option>` in `#filter` (`index.html:60-65`); the handler is the same
`change` listener; the output is `getVisibleItems` (`app.js:130-137`) and the status string at
`app.js:149`.

Write the acceptance example before editing, with `localToday` stubbed to `2026-09-08`: an item
expiring `2026-09-14` is in; `2026-09-15` is out; `2026-09-07` is already expired - decide
whether it is *also* "expiring soon" and write your answer down before you code, because it
changes the filter expression.

The trap, and the reason this is exercise 1: do **not** add `"Expiring"` as a third value of the
status. That is precisely the mistake this lesson undid - `backups/16/app.js` had
`item.quantity <= item.minimum ? "Low" : "Fresh"` and a fully stocked expired jar therefore read
"Fresh". Add a third independent predicate, `isExpiringSoon(item, today)`, beside `isExpired`
(`app.js:185`), and let the status line join whatever is true: `Low stock · Expiring soon` must
be expressible.

One more trap worth hitting on purpose: compute "seven days from now" with date arithmetic, not
string arithmetic. `new Date(y, m, d + 7)` rolls months and leap years correctly; adding 7 to the
day-of-month substring produces `2026-09-32`. Test across a month boundary (`2026-09-28` with a
seven-day window) so your fixture would catch it.

Regression to add: an item expiring exactly on day 7 and one on day 8, so the boundary is
pinned rather than assumed.

## Exercise 2 — independent variation

Add an expired counter beside `#low-items`, and make the two counts impossible to misread.

Close chapter 3. Describe your design in three sentences: which collection the count comes from,
which predicate it uses, and what proves it agrees with the rows.

`renderItems` computes `#low-items` from `items` - the whole inventory - not from `visibleItems`
(`app.js:143-144`), so it does not change when you filter. Keep your new counter consistent with
that and say so on screen, or you will ship a dashboard where two numbers beside each other
answer different questions.

Then the part that makes this more than a `filter().length`: the two counts **overlap**. An item
can be low *and* expired, so "3 low, 2 expired" does not mean five items need attention. Print
the union as well, or phrase the labels so nobody adds them. Work out the exact fixture that
demonstrates the overlap - one low-and-expired item is enough - and assert all three numbers.

The invariant to assert rather than hard-code: every row rendered with "Expired" in its status is
inside the expired count. Derive the expected numbers from the same fixture the rows come from,
so a future change to `isExpired` cannot make the counter and the rows disagree silently.

## Exercise 3 — failure-focused extension

Write clock-independent tests for the date edges - and then find the failure this project does
*not* handle.

**Part 1: the date edges.** Every date helper here takes `today` as a parameter
(`isExpired(item, today = localToday())`, `app.js:185`) precisely so a test never has to touch
the system clock. Use it. Cover: an expiry of `2024-02-29` against `today = '2024-03-01'`
(expired) and against `'2024-02-29'` (not expired - the comparison is a strict `<`, so expiring
today is fine); `2026-02-30` rejected by `isRealDate` (`app.js:187-190`) so it can never be
stored at all; and the string comparison's precondition - confirm `'2026-09-09' < '2026-09-10'`,
then try `'2026-9-9'` and explain why the shape regex must run first. Never change the machine's
timezone to make a test pass; stub `localToday` instead.

**Part 2: the failure this app does not survive.** `saveItem` mutates `items` and *then* calls
`persistItems()` (`app.js:83-91`), and `persistItems` (`app.js:62-64`) has no `try`. Capture the
state before: `items.length` and the raw `localStorage` string. Now stub
`Storage.prototype.setItem` to throw and submit a valid item. Record what happens: the exception
escapes the submit handler, `renderItems()` at `app.js:93` never runs, the new row is in memory
but not on screen and not on disk, and the user sees **nothing at all** - no message, no row, no
error. Reload and it is gone.

Then fix it, and model the fix on a sibling in this batch: `JS1/budget-tracker/app.js:205-210`
wraps the write in `commitTransactions(next)`, publishes only on success, and returns `false` so
each caller can bail out before resetting the form. Port that shape here and assert the four
things that must be unchanged after a rejected save: `items`, the stored bytes, the form
contents, and a `#message` the user can act on. Understandable recovery behaviour, not an
exception in a console nobody has open.

## Exercise 4 — stretch design

Design a local-midnight refresh, and say exactly what the existing `visibilitychange` listener
does and does not cover.

Stop at a design note plus a test plan. State the current guarantee precisely: status is derived
at render time (`app.js:149`), and `renderItems()` runs on load, on any edit, on a filter change,
and when the tab becomes visible again (`app.js:192`). So a tab you switch back to is correct,
and a tab left **visible** across midnight is not - it keeps yesterday's answer indefinitely, and
"Expired" is exactly the kind of label a user trusts without re-checking.

The stronger guarantee: the rendered status matches the user's local date within seconds of local
midnight, whether or not the tab was ever hidden.

Your note must reject the obvious implementation and say why - three separate reasons:
`setInterval(renderItems, 24 * 60 * 60 * 1000)` drifts on the two DST days of the year (a local
day is 23 or 25 hours); browsers throttle timers in background tabs, so the "24 hours" is a
minimum, not a schedule; and a sleeping laptop fires nothing at all. Specify instead: build
tomorrow's local midnight with `new Date(y, m, d + 1)` (which handles month, year and DST
transitions because the constructor works in local time), `setTimeout` for the difference from
`Date.now()`, and **re-arm inside the callback** so every wait is recomputed from the clock
rather than accumulated. Keep the `visibilitychange` listener as the backstop for sleep.

Name the two new failure modes you are introducing: a full `renderItems()` rebuilds every row, so
keyboard focus and any half-typed edit are lost at midnight; and a module-scope timer is never
cleared, which is harmless in a page and a leak the moment this file becomes a component.

Test plan: stub `localToday`, fire the trigger, assert a row's status changed - the shape the
third test in [test/expiration.test.cjs](../test/expiration.test.cjs) now uses for
`visibilitychange`. Do not test the timer by waiting; test the "what time is the next midnight?"
function directly, including on a DST date.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [app.js](../app.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
