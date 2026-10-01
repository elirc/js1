# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The current streak required today to be checked already, and there was no longest historical streak.

**After:** A current streak may continue through yesterday while today is still in progress. The best badge counts consecutive real dates, ignoring invalid, false and future entries. Day buttons have full accessible names.

## Predict this example

Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 209. It is a teaching snapshot; the
linked source is authoritative if you later edit the project. Read surrounding code for callers
and setup.

**This whole function is new.** `bestStreak` does not exist at all in
`AstraOrganized2/astrafinalplan/implementation/batch02/backups/12/app.js`; the change inserts it
between `currentStreak` and `button`. Two other edits ship with it, and both are one-liners you
should read alongside it:

```diff
  function currentStreak(habit) {
    let streak = 0;
    const cursor = startOfToday();
+   // Today is still in progress; yesterday may anchor an active streak.
+   if (!habit.history[isoDate(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (habit.history[isoDate(cursor)]) {
```

```diff
-     header.append(title, streak);
+     const best = document.createElement("span");
+     best.className = "streak-badge best-streak";
+     best.textContent = `Best: ${bestStreak(habit)} days`;
+     header.append(title, streak, best);
```

That first diff is the subtle one and it is only two lines: before it, a user who had checked in
for six days straight and had not yet checked in *today* saw a streak of **0**. The `while` loop
started at today, found nothing, and never ran.

```javascript
function bestStreak(habit, today = isoDate(startOfToday())) {
  const days = Object.entries(habit.history).filter(([date, checked]) => {
    if (checked !== true || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return false;
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }).map(([date]) => Date.parse(`${date}T00:00:00Z`) / 86400000).sort((a, b) => a - b);
  let best = 0, run = 0, previous;
  for (const day of days) {
    run = previous !== undefined && day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Neighboring local midnights may be 23 or 25 hours apart at daylight-saving changes. The history stores calendar labels, so bestStreak maps validated labels to UTC day ordinals only to compare adjacency. It does not reinterpret the habit as a UTC activity. Reject impossible dates by round-tripping their calendar representation: JavaScript may normalize February 30 into March. Sort ordinals, increase a run for a difference of one, reset it at a gap, and retain the maximum. Current streak uses local today and permits yesterday as an anchor because the user still has today to complete the habit. A complete missed day breaks it. Explain this rule rather than presenting it as the only possible definition of streak.

## Three variations to work through

Each is a concrete edit to the fixture in [test/streaks.test.cjs](../test/streaks.test.cjs).
Predict the number first, then run `node --test test/streaks.test.cjs`.

**Variation 1 (normal) - make 2024 not a leap year.**
Change the fixture's `'2024-02-29'` key to `'2023-02-29'` and leave everything else alone, still
passing `'2024-03-03'` as `today`. Predicted result: `bestStreak` drops from **3** to **1**, and
for two separate reasons you should be able to state independently. First, 2023 is not a leap
year, so `'2023-02-29'` round-trips to `'2023-03-01'` and is rejected at `app.js:213-214` -
exactly the same mechanism that rejects `'2024-02-30'`. Second, even if it had survived, its
ordinal is a year away from the others, so the run would not join. Now flip it back to
`'2024-02-29'` and confirm you get 3 again: February 28 → 29 → March 1 is a three-day run only
because of the leap day, which is why this fixture was chosen.

**Variation 2 (invalid) - use `1` instead of `true`.**
Change `'2024-03-01':true` to `'2024-03-01':1`. Predicted result: `bestStreak` returns **2**, not
3. The guard is `checked !== true` (`app.js:211`), a strict comparison, so a truthy `1` is
rejected and the run splits into Feb 28-29 (length 2) and nothing else. Zero writes happen -
`bestStreak` is a pure read and touches no storage; assert that by snapshotting
`app.w.localStorage.getItem('js1-habit-tracker')` before and after. This is the variation that
shows why "truthy" and "is `true`" are different decisions: `toggleDay` (`app.js:82-87`) only
ever stores `true` or deletes the key, so anything else in storage came from an older build or a
human, and the code chooses to distrust it rather than guess.

**Variation 3 (boundary) - move `today` back by one day.**
Keep the fixture and change the second argument of the first assertion from `'2024-03-03'` to
`'2024-02-29'`. Predicted result: still **2**, not 3. `'2024-03-01'` is now in the future
relative to `today` and is dropped by `date > today` at `app.js:211` - a *string* comparison,
which only works because ISO dates are zero-padded and therefore sort in calendar order. Try
`'2024-3-3'` as the `today` argument to see the comparison break: `'2024-03-01' > '2024-3-3'` is
`false` (because `'0' < '3'` at index 5), so the future filter silently stops filtering. That is
the boundary worth remembering - the fast string comparison carries a format precondition that
nothing in the function enforces.

## Executable examples

These are the actual regression tests in [test/streaks.test.cjs](../test/streaks.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('./browser.cjs');

test('best streak uses calendar days across leap day, gaps and invalid/future entries', async () => {
  const app = await openApp();
  try {
    const history = {'2024-02-28':true,'2024-02-29':true,'2024-03-01':true,'2024-03-03':true,'2024-03-04':false,'2024-02-30':true,'2025-01-01':true};
    assert.equal(app.evaluate(`bestStreak({ history: ${JSON.stringify(history)} }, '2024-03-03')`),3);
    assert.equal(app.evaluate("bestStreak({history:{}}, '2024-03-03')"),0);
    assert.equal(app.evaluate("bestStreak({history:{'2024-03-09':true,'2024-03-10':true,'2024-03-11':true}},'2024-03-11')"),3);
  } finally { app.close(); }
});
test('current streak can begin yesterday and becomes zero after a missed full day', async () => {
  const app = await openApp();
  try {
    app.evaluate('startOfToday = () => new Date(2024, 2, 11)');
    assert.equal(app.evaluate("currentStreak({history:{'2024-03-09':true,'2024-03-10':true}})"),2);
    assert.equal(app.evaluate("currentStreak({history:{'2024-03-09':true}})"),0);
    app.evaluate('render()');
    assert.equal(app.document.querySelectorAll('.best-streak').length,2);
    assert.match(app.document.querySelector('.day-cell').getAttribute('aria-label'),/2024-03-/);
  } finally { app.close(); }
});

test("render writes the correct best-streak number into each habit's badge", async () => {
  const seeded = [
    {
      id: "h1",
      name: "Read 20 pages",
      color: "teal",
      history: {
        "2024-03-07": true,
        "2024-03-08": true,
        "2024-03-09": true,
        "2024-03-11": true,
      },
    },
    { id: "h2", name: "Stretch", color: "indigo", history: { "2024-03-09": true } },
  ];
  const app = await openApp({ "js1-habit-tracker": JSON.stringify(seeded) });
  try {
    // Pin the clock so both the default `today` argument of bestStreak and the
    // seven-day grid are deterministic.
    app.evaluate("startOfToday = () => new Date(2024, 2, 11)");
    app.evaluate("render()");

    const badges = [...app.document.querySelectorAll(".best-streak")].map(
      (el) => el.textContent,
    );
    // Mar 7-8-9 is a three-day run; Mar 11 is a separate one-day run.
    // Habit two has a single check-in, so its best run is one.
    assert.deepEqual(badges, ["Best: 3 days", "Best: 1 days"]);

    // The current-streak badge is a different computation on the same data:
    // today (Mar 11) is checked for habit one, Mar 10 is not, so it is 1.
    const current = [...app.document.querySelectorAll(".streak-badge")]
      .filter((el) => !el.classList.contains("best-streak"))
      .map((el) => el.textContent);
    assert.deepEqual(current, ["1 day streak", "0 day streak"]);
  } finally {
    app.close();
  }
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
