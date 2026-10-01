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
