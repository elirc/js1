# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

A current streak may continue through yesterday while today is still in progress. The best badge counts consecutive real dates, ignoring invalid, false and future entries. Day buttons have full accessible names.

The key model is: Each habit has a history map from YYYY-MM-DD to true. Current and best streaks are derived values, not independently persisted counters.

The worked fixture should behave as follows: Checks on February 28, February 29 and March 1, 2024 give best three. Add March 3 and invalid February 30: best remains three. With today March 11, checks on March 9 and 10 give current two; a check only on March 9 gives zero.

## Extension solutions

### Exercise 1

**Prompt:** Show the best streak start and end dates.

**Approach:** Track runStart and the winning range, choosing and testing a tie policy.

**Review:** You are done when the displayed range is the *same* run `bestStreak` counted, including when two runs tie. The naive implementation re-walks `habit.history` with its own loop and quietly uses different rules - it forgets `checked !== true`, or compares dates with `new Date(a) - new Date(b)` instead of the pinned-UTC ordinals at `app.js:215`. Have `bestStreak` return the range (or a second function share the same filtered, sorted ordinal array) rather than duplicating the predicate; two copies of a date filter will drift. Show the tie case explicitly: two separate three-day runs must produce one answer, and you must be able to say which one and why.

### Exercise 2

**Prompt:** Extend the visible grid to 30 days.

**Approach:** Parameterize the window and its denominator; keep best streak based on all history.

**Review:** You are done when 30 days render and *nothing else changes*. `WEEK_LENGTH` (`app.js:2`) is used in three places that mean different things: the grid width (`lastNDays(WEEK_LENGTH)` at `app.js:128`), the per-habit percentage denominator (`app.js:166-167`) and the overall denominator (`app.js:188`). The naive implementation changes the constant and silently relabels "days this week" as a 30-day figure while the text still says "this week". Decide whether the visible window and the completion window are the same concept - they are currently the same constant by accident - and say so in a comment. The invariant that must not move: `bestStreak` and `currentStreak` read `habit.history`, not the rendered grid, so widening the grid must not change either number.

### Exercise 3

**Prompt:** Test the autumn daylight-saving transition.

**Approach:** Use consecutive date labels around the fall transition and expect adjacency despite 25 elapsed hours.

**Review:** You are done when the test proves the *labels* stay consecutive while the *elapsed time* does not. The naive implementation asserts `bestStreak` returns 3 on a machine already set to a US timezone and calls it a DST test - it would pass with a broken implementation anywhere else. Pin the fixture instead: pass the `today` argument explicitly, use dates spanning 2024-11-03 (the autumn transition in America/New_York, a 25-hour local day), and add a second assertion showing that `(Date.parse(b) - Date.parse(a)) / 86400000` is exactly 1 for the two local midnights involved. Also state what the test does *not* prove: `isoDate` and `lastNDays` still use the machine's timezone, so the grid contents remain environment-dependent.

### Exercise 4

**Prompt:** Refresh an open page across midnight.

**Approach:** Compute the next local midnight with calendar setters, refresh and reschedule; do not assume a fixed 24-hour delay.

**Review:** This is the stretch design, so the deliverable is a note plus a test plan. You are done when the note names the exact value that goes stale (`lastNDays(WEEK_LENGTH)`, computed once per `render()` at `app.js:128`) and the exact trigger you will use. "Call `setInterval(render, 24*60*60*1000)`" is the naive answer and it is wrong twice: a DST day is 23 or 25 hours, and a laptop that was asleep fires late or not at all. Name a scheme that recomputes the delay from the clock each time, plus a `visibilitychange` listener as a backstop (pantry-inventory in this same batch uses exactly that; `JS1/pantry-inventory/app.js:183`). State the new failure mode you introduce: a re-render at midnight replaces every DOM cell, so focus and any in-progress interaction are lost.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/streaks.test.cjs](../test/streaks.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The current streak required today to be checked already, and there was no longest historical streak. I changed the implementation so that: A current streak may continue through yesterday while today is still in progress. The best badge counts consecutive real dates, ignoring invalid, false and future entries. Day buttons have full accessible names. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
