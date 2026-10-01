# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

The interval is a wake-up mechanism. The deadline determines remaining time. Delayed callbacks catch up, pausing preserves fractions of a second, repeated starts do not stack intervals, and late callbacks cannot log the same completion twice.

The key model is: The timer has mode (idle/running/paused), remaining seconds, deadline milliseconds, duration seconds and intervalId. Session records are separate persisted history. A running timer is in-memory; page reload does not resume an active run.

The worked fixture should behave as follows: A 60-second session starts at t=0. The browser delays callbacks until t=45: one tick must display 00:15, not 00:59. At t=75 the next tick completes once. If paused at 1.25 seconds, 58.75 seconds remain; a two-minute pause does not consume them.

## Extension solutions

### Exercise 1

**Prompt:** Add a five-minute break phase with exactly one transition from focus.

**Approach:** Add `phase` alongside `mode`. `mode` stays the scheduling state machine (idle/running/paused); `phase` says what is being timed. Keep them separate or the four-way product will leak into every guard.

```javascript
const timer = {
  mode: "idle",
  phase: "focus",          // "focus" | "break"
  remaining: 25 * 60,
  deadline: null,
  duration: 25 * 60,
  intervalId: null
};

const BREAK_SECONDS = 5 * 60;

function completeSession() {
  if (timer.mode !== "running") return;
  const finished = timer.phase;               // capture before the transition
  timer.mode = "idle";
  timer.deadline = null;
  clearInterval(timer.intervalId);
  timer.intervalId = null;

  let logged = true;
  if (finished === "focus") {                 // breaks are not logged as focus time
    const session = { id: crypto.randomUUID(), label: labelInput.value.trim() || "Focus session",
                      minutes: Math.round(timer.duration / 60), completedAt: new Date().toISOString() };
    logged = commitSessions([session, ...state.sessions]);
  }

  // Exactly one transition: focus -> break, break -> focus. Never scheduled from render.
  timer.phase = finished === "focus" ? "break" : "focus";
  timer.remaining = timer.phase === "break" ? BREAK_SECONDS : configuredSeconds();
  timer.duration = timer.remaining;
  minutesInput.disabled = timer.phase === "break";
  renderTimer();
  renderSessions();
  showMessage(/* ... as before, plus which phase is next ... */);
}
```

**Review:** Two implementations break here and both are worth demonstrating. The first calls `startTimer()` at the end of `completeSession` to auto-start the break; now a delayed `tick()` that arrives one millisecond later finds `mode === "running"` again and the idempotency guard - the one thing this whole course is about - stops protecting anything, because the state it checks has already been re-entered. Prove it: `advance` past the deadline and call `tick(); tick()`, then assert `state.sessions.length === 1`. The second encodes the phase in `mode` (`"running-break"`), which quietly multiplies every guard in `startTimer`, `pauseTimer`, `tick` and `completeSession` and will be wrong in at least one of them. The invariant that remains unchanged: exactly one completion per elapsed deadline, and breaks add nothing to `state.sessions` - assert the log length after a full focus-break-focus cycle is 2, not 3.

### Exercise 2

**Prompt:** Persist a running timer across reload and specify how downtime counts.

**Approach:** The running timer becomes persisted state, under its own key so a corrupt run cannot cost the user their session log. The policy must be written down *before* the code, because there are three defensible answers and the code cannot tell you which one you meant.

Policy chosen here: **a deadline that passed while the page was closed counts as completed**, because the user's wall-clock minute really did elapse. (The alternatives - discard the run, or resume with the remaining time frozen at close - are equally defensible and equally arbitrary if you do not say so.)

```javascript
const RUN_KEY = "js1-focus-timer:run";

function saveRun() {
  const run = timer.mode === "idle" ? null
    : { mode: timer.mode, deadline: timer.deadline, remaining: timer.remaining, duration: timer.duration };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* the log matters more */ }
}

function restoreRun() {
  let run;
  try { run = JSON.parse(localStorage.getItem(RUN_KEY) || "null"); } catch { return; }
  if (!run) return;
  if (run.mode === "paused") { Object.assign(timer, run); return; }   // paused time is free
  const remainingMs = run.deadline - Date.now();
  timer.duration = run.duration;
  if (remainingMs <= 0) {
    // Policy: it finished while we were away. Re-enter running so the guard lets it complete once.
    timer.mode = "running";
    timer.deadline = run.deadline;
    completeSession();
  } else {
    timer.remaining = remainingMs / 1000;
    startTimer();
  }
}
```

**Review:** The ordinary case is a reload two seconds into a 60-second run: the display must read 00:58, not 01:00, and `state.sessions` must still be empty. The case that breaks a naive implementation is the expired one, and it breaks in *two* different ways depending on the mistake. Persist `remaining` instead of `deadline` and a five-minute absence costs the user nothing - the timer resumes exactly where it stopped, which silently converts wall-clock minutes into page-open minutes. Persist the deadline but call the logging code directly instead of going through `completeSession`, and you lose the `mode !== "running"` guard: open the app in two tabs and you log the same session twice. Demonstrate both with a fixture that seeds `RUN_KEY` with a deadline in the past, then asserts exactly one session after two `openApp` calls sharing a snapshot. The invariant that remains unchanged: the session log is still written only through `commitSessions`, so a failed run-state write can never corrupt it - note the deliberately swallowed error in `saveRun`.

### Exercise 3

**Prompt:** Replace the clock with an injectable monotonic clock for an in-tab-only timer.

**Approach:** Every reference to time goes through one injected function, so the test harness and a monotonic clock become interchangeable.

```javascript
// One seam. The harness overrides w.Date.now today (test/browser.cjs:27); this makes that explicit.
const clock = { now: () => performance.now() };   // monotonic, milliseconds, page-local origin

function startTimer() {
  if (timer.mode === "running") return;
  clearInterval(timer.intervalId);
  if (timer.mode === "idle") {
    timer.remaining = configuredSeconds();
    timer.duration = timer.remaining;
  }
  timer.deadline = clock.now() + timer.remaining * 1000;   // was Date.now()
  timer.mode = "running";
  minutesInput.disabled = true;
  timer.intervalId = setInterval(tick, 1000);
  renderTimer();
  showMessage("");
}

function tick() {
  if (timer.mode !== "running") return;
  timer.remaining = Math.max(0, (timer.deadline - clock.now()) / 1000);
  if (timer.remaining <= 0) { completeSession(); return; }
  renderTimer();
}
```

`completedAt` must keep using `new Date().toISOString()`: a log entry needs a wall-clock time a human can read, and `performance.now()` is a number of milliseconds since this page loaded.

**Review:** The ordinary case is that all five existing tests still pass once the harness stubs `clock.now` instead of `Date.now`. The case that breaks a naive implementation is the one the exercise title warns about - persisting a `performance.now()`-based deadline. Do it, reload, and the stored deadline is measured from a time origin that no longer exists; depending on how long the page was closed the timer either completes instantly or runs for hours. Demonstrate it by writing a deadline of `performance.now() + 60000` to storage, reopening the app, and printing the computed remaining time. That is precisely why exercise 2's persisted run stores a `Date.now()` deadline while an in-tab timer should use `performance.now()`: **the two clocks answer different questions, and neither is a drop-in replacement.** The invariant that remains unchanged: `remaining` is still derived from two readings of one clock, never accumulated - which is why swapping the clock is a one-line change in two places rather than a rewrite.

### Exercise 4

**Prompt:** Add a test that repeatedly pauses at fractional-second boundaries.

**Approach:** The test is the deliverable. Pause and resume at deliberately awkward offsets that never land on a second boundary, and assert on the total *active* time rather than on any intermediate display.

```javascript
test("many fractional pauses do not create or destroy time", async () => {
  const app = await openApp();
  app.document.querySelector("#session-minutes").value = "1";
  app.evaluate("startTimer()");

  let active = 0;
  for (const slice of [1250, 3333, 7, 999, 40001, 1]) {   // sums to 46591 ms
    app.advance(slice);
    active += slice;
    app.evaluate("pauseTimer()");
    app.advance(120000);                                   // paused time must be free
    app.evaluate("startTimer()");
  }
  app.evaluate("tick()");
  assert.equal(app.evaluate("timer.mode"), "running");
  assert.equal(app.evaluate("timer.remaining"), (60000 - active) / 1000);  // 13.409

  app.advance(60000 - active - 1);
  app.evaluate("tick()");
  assert.equal(app.evaluate("timer.mode"), "running");     // one millisecond short
  app.advance(1);
  app.evaluate("tick()");
  assert.equal(app.evaluate("timer.mode"), "idle");
  assert.equal(app.evaluate("state.sessions.length"), 1);
  app.close();
});
```

**Review:** The ordinary case is that the loop runs six times and the session still takes exactly 60,000 milliseconds of active time - the assertion is on `timer.remaining` as an exact number, `13.409`, not on the rendered `00:14`. The implementation that breaks is rounding in `pauseTimer`: change `app.js:94` to `Math.round(...)` and each pause silently rounds up to the next whole second, so six pauses give the user back up to six seconds of work. The display already rounds up (`Math.ceil` at `app.js:177`), which is why a test that reads `#timer-display` cannot catch this and a test that reads `timer.remaining` can - choosing the right observation is most of test design. Watch the exact-equality assertion on a float: 58.75 and 13.409 are exact in binary floating point because the millisecond values divide cleanly, but `(60000 - 33333)/1000` would not be; if you change the slices, assert with a tolerance or compare in milliseconds. The invariant that remains unchanged: completion is still decided by `deadline - now`, so the number of pauses, ticks and renders is irrelevant to when the session ends.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/timer.test.cjs](../test/timer.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Each interval callback subtracted one second, so a throttled background tab could show a large amount of time remaining even after the session’s real duration had elapsed. I changed the implementation so that: The interval is a wake-up mechanism. The deadline determines remaining time. Delayed callbacks catch up, pausing preserves fractions of a second, repeated starts do not stack intervals, and late callbacks cannot log the same completion twice. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
