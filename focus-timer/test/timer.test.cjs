const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");
test("one delayed callback accounts for all elapsed time and completes only once", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer(); startTimer()");
  assert.equal(app.intervals.size, 1);
  app.advance(45000);
  app.evaluate("tick()");
  assert.equal(
    app.document.querySelector("#timer-display").textContent,
    "00:15",
  );
  app.advance(30000);
  app.evaluate("tick(); tick(); completeSession()");
  assert.equal(
    JSON.parse(app.w.localStorage.getItem("js1-focus-timer")).length,
    1,
  );
  assert.equal(app.intervals.size, 0);
  app.close();
});
test("pause preserves subsecond remainder and excludes paused time", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer()");
  app.advance(1250);
  app.evaluate("pauseTimer()");
  assert.equal(app.evaluate("timer.remaining"), 58.75);
  app.advance(120000);
  app.evaluate("startTimer()");
  app.advance(58749);
  app.evaluate("tick()");
  assert.equal(app.evaluate("timer.mode"), "running");
  app.advance(1);
  app.evaluate("tick()");
  assert.equal(app.evaluate("timer.mode"), "idle");
  app.close();
});
test("reset cancels a run; pausing after its deadline logs a completed session", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer(); resetTimer()");
  app.advance(90000);
  app.evaluate("tick()");
  assert.equal(app.evaluate("state.sessions.length"), 0);
  app.evaluate("startTimer()");
  app.advance(60000);
  app.evaluate("pauseTimer()");
  assert.equal(app.evaluate("state.sessions.length"), 1);
  app.close();
});
test("a failed write logs no session but still stops the timer and says so", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer()");
  app.advance(60000);
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); }; tick()",
  );
  assert.equal(app.evaluate("state.sessions.length"), 0);
  assert.equal(app.w.localStorage.getItem("js1-focus-timer"), null);
  assert.equal(app.evaluate("timer.mode"), "idle");
  assert.equal(app.intervals.size, 0);
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /could not be saved/,
  );
  app.close();
});
test("a failed write does not delete a logged session", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer()");
  app.advance(60000);
  app.evaluate("tick()");
  const stored = app.w.localStorage.getItem("js1-focus-timer");
  assert.equal(JSON.parse(stored).length, 1);
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); }; deleteSession(state.sessions[0].id)",
  );
  assert.equal(app.evaluate("state.sessions.length"), 1);
  assert.equal(app.w.localStorage.getItem("js1-focus-timer"), stored);
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /Could not delete/,
  );
  app.close();
});
