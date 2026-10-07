# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Each interval callback subtracted one second, so a throttled background tab could show a large amount of time remaining even after the session’s real duration had elapsed.

**After:** The interval is a wake-up mechanism. The deadline determines remaining time. Delayed callbacks catch up, pausing preserves fractions of a second, repeated starts do not stack intervals, and late callbacks cannot log the same completion twice.

## Predict this example

A 60-second session starts at t=0. The browser delays callbacks until t=45: one tick must display 00:15, not 00:59. At t=75 the next tick completes once. If paused at 1.25 seconds, 58.75 seconds remain; a two-minute pause does not consume them.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 114. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function tick() {
  if (timer.mode !== "running") return;
  timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
  if (timer.remaining <= 0) {
    completeSession();
    return;
  }
  renderTimer();
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Scheduled callbacks are opportunities to run code, not a guarantee about elapsed time. Tabs can be throttled and the event loop can be busy. The equation remaining = max(0, (deadline - now) / 1000) separates measurement from scheduling. Keep fractional seconds internally and round only at the display boundary; rounding the stored remainder on every pause would let repeated pauses add time. The mode guard is an idempotency mechanism: after the first completion leaves running, another queued callback becomes harmless. Date.now is a wall clock and can jump if the system clock changes; this implementation fixes delayed-callback drift, not every possible clock-adjustment problem. A monotonic performance clock or a persisted wall-clock deadline each has different tradeoffs. The lesson is to state the clock assumption and test the failure mode you actually promised to fix.

### The other changed region: the write boundary

`tick` above is the delivered change. The second region is `completeSession` and its neighbours, rewritten in the 2026-09-17 follow-up because the course promised a failure boundary the project did not have, and because `completeSession` contained a dead assignment.

Before (`git show 606e0e6:focus-timer/app.js` plus the delivered guard):

```javascript
function completeSession() {
  if (timer.mode !== "running") return;
  timer.mode = "idle";                      // the idempotency guard's other half
  timer.deadline = null;
  clearInterval(timer.intervalId);
  timer.intervalId = null;

  const minutes = Math.round(timer.duration / 60);
  state.sessions.unshift({ id: crypto.randomUUID(), /* ... */ });
  saveSessions();                           // unguarded write

  timer.mode = "idle";                      // dead: line 118 already did this
  timer.remaining = configuredSeconds();
  minutesInput.disabled = false;
  /* ... */
  showMessage("Session complete and logged.");
}
```

After (`app.js:124-149`):

```javascript
  const minutes = Math.round(timer.duration / 60);
  const session = {
    id: crypto.randomUUID(),
    label: labelInput.value.trim() || "Focus session",
    minutes,
    completedAt: new Date().toISOString()
  };
  // The session really did finish, so the timer resets either way. Only the log is conditional.
  const logged = commitSessions([session, ...state.sessions]);

  timer.remaining = configuredSeconds();
  minutesInput.disabled = false;

  renderTimer();
  renderSessions();
  showMessage(logged
    ? "Session complete and logged."
    : "Session complete, but it could not be saved. Your earlier sessions are unchanged.");
```

with `saveSessions` replaced by (`app.js:52-62`):

```javascript
function commitSessions(next) {
  try {
    // Persist first. A failed write must not leave a session on screen
    // that the next reload will erase.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  state.sessions = next;
  return true;
}
```

Three things to notice. First, the duplicated `timer.mode = "idle"` is gone; it was dead code sitting inside the exact function the course asks you to study for its guard, and dead code next to a subtle guard makes the guard look accidental. Second, `state.sessions.unshift(...)` became `[session, ...state.sessions]`, so the array the UI is reading is not mutated until the write succeeds. Third - and this is the interesting design call - the timer state is **not** conditional on the write. The minute really did elapse; refusing to stop the timer because storage is full would be lying about the clock. Only the *log* is conditional, and the message says which half failed.

## Three variations to work through

All three use the harness's controllable clock (`app.advance(ms)` in [test/timer.test.cjs](../test/timer.test.cjs)), because none of them is practical to observe by waiting.

**Variation 1 - the system clock jumps backwards mid-session.** Start a 1-minute session, `app.advance(30000)`, then set the clock *back* by 20 seconds (in the harness: `app.advance(-20000)`; in a browser this is a manual clock change or a DST/NTP correction). Predicted: the display jumps from 00:30 to 00:50, and the session takes 80 real seconds. `remaining = max(0, (deadline - Date.now())/1000)` trusts `Date.now()` completely, and `Date.now()` is a wall clock. This is exactly the limit chapter 3 names - "this implementation fixes delayed-callback drift, not every possible clock-adjustment problem". The fix is a monotonic clock (`performance.now()`), which is exercise 3, and the cost is that `performance.now()` values are meaningless after a reload.

**Variation 2 - advance past the deadline while paused.** Start a 1-minute session, `advance(1250)`, `pauseTimer()` (`timer.remaining` is now 58.75), then `advance(600000)` - ten minutes of paused time - then `tick()`. Predicted: **nothing happens.** `tick` returns immediately at `app.js:115` because `timer.mode` is `"paused"`, and `timer.deadline` is `null` (`app.js:96`) so there is no deadline to compare against. Then `startTimer()` rebuilds the deadline from the *remainder*, not from the original start (`app.js:84`), so 58.75 seconds still remain. Test 2 already asserts the 58.75; add the ten-minute pause and assert it again to prove paused time is genuinely excluded rather than merely small.

**Variation 3 - two ticks in the same millisecond, straddling the deadline.** Advance exactly to the deadline and call `tick(); tick(); completeSession()` with no clock movement in between (test 1 does this). Predicted: exactly **one** logged session and `intervals.size === 0`. The first call computes `remaining <= 0`, runs `completeSession`, which sets `timer.mode = "idle"` at `app.js:126` *before* doing anything else; the second and third calls hit the `mode !== "running"` guard and return. Now delete that guard in a scratch copy and re-run: three log entries with three different ids, from one minute of work. This is the same bug shape as a double-submitted POST, and chapter 2's "the same guard in an HTTP handler" section spells out the server version.

## Executable examples

These are the first three of the five regression tests in [test/timer.test.cjs](../test/timer.test.cjs); cases 4 and 5 force a failing `Storage.prototype.setItem` on the completion and delete paths. Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
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
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
