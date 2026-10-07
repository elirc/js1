# Trace lab: Two independent flags need four cases

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const today = '2026-09-08';
const low = item => item.quantity <= item.minimum;
const expired = item => item.expires < today;
// Validated YYYY-MM-DD labels can be compared lexicographically.
```

## Follow the boundary with concrete values

There is no HTTP layer here, so the six boundaries a server request crosses appear as six
in-process ones. Two of them - the two predicates - are the entire lesson, because the bug being
fixed was that they used to be one. Walk them with the fixture from
[test/expiration.test.cjs](../test/expiration.test.cjs).

**Boundary 1 - the input surface (the form in `index.html`, handler `saveItem`, `app.js:66-94`).**
Five fields become one candidate object at `app.js:69-76`. Note the representations: `quantity`
and `minimum` go through `Number(...)`, `expires` stays a string, and `id` is either the hidden
field's value or a fresh `crypto.randomUUID()`. Write down what `Number("")` is before you read
the next boundary - the answer is why the guard below is longer than it looks.

**Boundary 2 - validation (`app.js:78-81`).**
Eight conditions in one `if`, and two of them look redundant until you try to remove them:
`Number.isFinite(item.quantity)` **and** `quantityInput.value === ""`. `Number("")` is `0`, which
is finite and is `>= 0`, so a blank quantity passes every numeric check ever written and silently
records "we have zero of this". The empty-string test is the only thing that catches it. The
same shape of trap catches `isRealDate` (`app.js:187-190`): `new Date('2026-02-30T00:00:00Z')`
does not throw, it rolls forward to March 1, so the guard round-trips through
`toISOString().slice(0, 10)` and compares against the input. Predict the outcome for
`{quantity: "", minimum: "1", expires: "2026-09-09"}` - the delivered test asserts it.

**Boundary 3 - persistence and publication (`persistItems`, `app.js:62-64`).**
`saveItem` mutates `items` first (`app.js:84` or `:87`) and calls `persistItems()` afterwards
(`app.js:91`), with no `try`. Write down what a full-quota `localStorage` does here: the
exception escapes the submit handler, the screen is never re-rendered, and memory now disagrees
with disk. Three sibling courses in this batch - flashcards, budget-tracker, snippet-vault -
close exactly this gap; this one does not, and exercise 3 asks you to.

**Boundary 4 - today, in the user's timezone (`localToday`, `app.js:180-183`).**
`` `${date.getFullYear()}-${...getMonth()+1...}-${...getDate()}` `` - built from **local**
getters. The tempting one-liner is `new Date().toISOString().slice(0, 10)`, and it is wrong for
everyone west of UTC: at 19:00 in New York it is already tomorrow in UTC, so a jar expiring
"today" would be reported expired hours early. Work it out for 23:00 local in New York and 01:00
local in Berlin, and write both answers down. This is the most reusable line in the project.

**Boundary 5 - the two independent predicates (`getVisibleItems`, `app.js:130-137`, and
`isExpired`, `app.js:185`).**
`const isLow = item.quantity <= item.minimum;` and `item.expires < today`. They are computed
separately and combined only in the filter expression, which is what lets a row be
"Stock OK · Expired". In `git show 606e0e6:pantry-inventory/app.js` the status was a single ternary -
`item.quantity <= item.minimum ? "Low" : "Fresh"` - so a fully stocked expired jar read "Fresh".
Build the four-row truth table: low+expired, low+fresh, stocked+expired, stocked+fresh. The
Expired filter accepts rows 1 and 3; Low accepts 1 and 2; "In stock & not expired" accepts only
row 4. Note the consequence for the counters: a low count and an expired count **overlap**, so
adding them does not give the number of items needing attention.

**Boundary 6 - render, and when it re-runs (`renderItems`, `app.js:139-178`, listener at
`app.js:192`).**
Status is derived at render time (`app.js:149`), never stored on the record - which is why
nothing has to be migrated when the date changes, and why the row is only as fresh as the last
`renderItems()` call. `document.addEventListener("visibilitychange", ...)` at `app.js:192` is the
re-render trigger, and it has a precise limit: it fires when you *return* to the tab, so a tab
left **visible** across midnight still shows yesterday's answer. Say what would fix that (a
timer re-armed from the clock each time, not `setInterval(24h)`) and what it costs (a full
re-render discards focus).

## Connect the model to real code

Open [app.js](../app.js) beside [test/expiration.test.cjs](../test/expiration.test.cjs). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

On September 8, an item expiring September 7 with quantity five and minimum one is Stock OK and Expired. An item expiring today with quantity one and minimum one is Low stock and not expired. Only a future sufficiently stocked item matches the combined view.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
