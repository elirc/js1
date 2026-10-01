# Trace lab: Calendar adjacency survives daylight-saving transitions

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const labels = ['2024-03-09', '2024-03-10', '2024-03-11'];
const ordinals = labels.map(day => Date.parse(day + 'T00:00:00Z') / 86400000);
console.log(ordinals[1] - ordinals[0]); // 1
console.log(ordinals[2] - ordinals[1]); // 1
```

## Follow the boundary with concrete values

This project has no HTTP layer, so the six boundaries a server request crosses appear here as six
in-process ones, and a date changes representation at four of them. Walk them in order and write
the concrete value at every hand-off.

**Boundary 1 - the input surface (`render`, `app.js:149-160`).**
A day cell is a `<button>` built in the `week.forEach` loop. Two things are decided here and
nowhere else: the *set* of days that can be clicked (`lastNDays(WEEK_LENGTH)` at `app.js:128`,
i.e. the last seven **local** days) and the label each click will carry
(`cell.addEventListener("click", () => toggleDay(habit.id, iso))` at `app.js:158`). Write down
what the click carries: a habit id and an ISO **string**, never a `Date`. That is deliberate -
by the time anything leaves this boundary, the timezone question has already been answered.

**Boundary 2 - local clock to calendar label (`isoDate`, `app.js:250-255`).**
`iso` came from `isoDate(day)`, which builds the string from `getFullYear/getMonth/getDate`.
Contrast that with `date.toISOString().slice(0,10)`, which would answer in UTC: at 23:00 local
time in New York those two functions return different days. Write both values for a `Date` of
2024-03-10 23:00 America/New_York and confirm you can say which one this app stores.

**Boundary 3 - the write (`toggleDay`, `app.js:79-92`).**
`toggleDay` builds a replacement `history` object (`{ ...habit.history }`) and a replacement
habit, then a replacement `state.habits` array. The domain rule lives in the `if`: a day that is
present is **deleted**, not set to `false`. That is why `bestStreak` later has to treat
`checked !== true` as a rejection rather than assuming every key means "done" - a `false` can
only arrive from hand-edited storage or an older build. Note what is *not* here: no validation.
Anything in `localStorage` is trusted at this boundary.

**Boundary 4 - persistence (`saveHabits`, `app.js:46-48`).**
`localStorage.setItem(STORAGE_KEY, JSON.stringify(state.habits))`, called from `toggleDay` at
`app.js:90` **after** `state.habits` has already been reassigned. Write that ordering down, and
notice it is the opposite of the write-then-publish order that flashcards, budget-tracker and
snippet-vault all use: if this `setItem` throws, the screen shows a check-in that is not stored.
That is a real, currently-unguarded gap in this project and exercise 3 asks you to close it.

**Boundary 5 - validation, at read time rather than write time (`bestStreak`, `app.js:210-214`).**
This is the decisive guard of the lesson, and it sits on the *read* side. Four rejections in one
predicate: `checked !== true` (a `false` or a truthy non-`true`), the shape test
`/^\d{4}-\d{2}-\d{2}$/`, the future test `date > today` (a string comparison, which is
correct only because ISO dates sort lexicographically), and the round-trip
`new Date(\`${date}T00:00:00Z\`).toISOString().slice(0,10) === date`. The round-trip is the
one that matters: `new Date('2024-02-30T00:00:00Z')` does **not** throw, it silently becomes
March 1. Write out what the predicate returns for each of the seven fixture keys before you run
anything.

**Boundary 6 - ordinals, run length and render (`app.js:215-222`, then `app.js:142-144`).**
Only surviving labels are converted to ordinals by `Date.parse(...)/86400000`. Because both ends
are pinned to `T00:00:00Z`, every difference is exactly 1 for consecutive calendar days - even
across a DST transition, where the *elapsed time* between two local midnights is 23 or 25 hours.
The run counter then walks the sorted ordinals, and `render` writes the result into
`Best: ${bestStreak(habit)} days` on the `.best-streak` badge at `app.js:142-144`. Note that the
badge does not use `bestStreak`'s `today` parameter - it takes the default - so the badge you see
in the browser always uses the real clock.

### Rows to fill in

List current-versus-best examples: an old five-day run with no check yesterday gives best five
and current zero; a two-day run ending yesterday gives current two while today is still
available (that is the `if (!habit.history[isoDate(cursor)]) cursor.setDate(...)` line at
`app.js:200`). Removing one historic check may split the best run without changing the recent
current run. Add an invalid February 30 and explain why boundary 5 must run before boundary 6.

## Connect the model to real code

Open [app.js](../app.js) beside [test/streaks.test.cjs](../test/streaks.test.cjs). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
