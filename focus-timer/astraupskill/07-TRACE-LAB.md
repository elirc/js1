# Trace lab: elapsed time is not callback count

[Course index](README.md)

## Hand-calculate a delayed callback

A 60-second session starts at clock 100,000 milliseconds. Its deadline is 160,000. The next callback occurs at 145,000: only 15 seconds remain even if just one callback ran.

Decrementing a counter once per callback would show 59, which describes callback delivery rather than elapsed time. Write units beside every variable: minutes, seconds and milliseconds are different representations.

## Preserve fractional time across pause

Pause at 145,250: there are 14,750 milliseconds left. Resume at 200,000: the new deadline should be 214,750. Paused time must not count. Keep the fractional duration in state even when display text rounds it upward.

Trace interval creation, clearing, pause and resume in [app.js](../app.js). Explain why repeatedly pressing Start cannot create stacked intervals.

## Complete exactly once

A delayed callback and a visibility refresh may both notice an expired deadline. The first completion must leave the running state before another call can append another log. The regression moves the fake clock beyond the deadline and invokes the updater twice; it expects one completion.

A fake clock replaces the time dependency, not the app's business functions. It makes a minute-long scenario immediate and repeatable.

This improvement handles delayed callbacks. It does not preserve an active session across reload or promise protection from system-clock changes. Completed session records retain their existing persistence. A resume-after-reload extension needs a saved state format and a policy for sessions that expired while the page was closed.
## The six boundaries of one completed session

The timer has the same boundaries as a CRUD request; they are just all in one file, and the "request" is a scheduled callback rather than an HTTP message. Walk them with [app.js](../app.js) open.

**1. The input surface - `index.html` + `app.js:32-43`.** Three distinct trigger sources, which is why this app is worth tracing: a user click (`#start-button` -> `onStartButton`, `app.js:32`), a `change` on `#session-minutes` that only takes effect while idle (`app.js:34-39`), and two inputs nobody clicked - the 1-second interval registered at `app.js:87` and the `visibilitychange` listener at `app.js:41-43` that calls `tick()` when a throttled tab comes back. Layers 2 onwards cannot tell which of the three called them, and must not care.

**2. Normalization - `configuredSeconds`, `app.js:64-67`.** `Number(minutesInput.value) || 1` then clamped to 1..120, then multiplied by 60. This is the only place a string becomes a number in this app, and it is worth reading closely: `Number("") || 1` is 1, `Number("abc") || 1` is 1, `Number("0") || 1` is 1 (because `0` is falsy, not because 0 is out of range), and `Number("7.5")` survives as 450 seconds. Write the units next to every variable - the field is minutes, `timer.remaining` and `timer.duration` are seconds, `timer.deadline` and `Date.now()` are milliseconds. Three representations of time in one object.

**3. The guard layer - `startTimer:78`, `pauseTimer:93`, `tick:115`, `completeSession:125`.** Four functions, each opening with a `timer.mode` check. Together they are the state machine's edge list: you may only start from not-running, only pause from running, only tick while running, only complete while running. `startTimer` also calls `clearInterval(timer.intervalId)` at line 79 *before* scheduling, so even a mode check that somehow let two starts through could not stack two intervals - belt and braces, and test 1 asserts `intervals.size === 1`. Nothing has been written at this point.

**4. The measurement - `tick:116` and `pauseTimer:94`.** `timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000)`, computed identically in both. This is the line the whole course is about: elapsed time is *derived* from two timestamps, never accumulated by counting callbacks. `pauseTimer` then nulls the deadline (`app.js:96`) and `startTimer` rebuilds it from the surviving remainder (`app.js:84`), which is what makes paused time free. Keep the fraction: rounding here rather than at the display boundary would let repeated pauses invent time.

```javascript
const deadline = 100000 + 60000;
const remainingMs = Math.max(0, deadline - 145000); // 15000
const seconds = Math.ceil(remainingMs / 1000); // 15
```

**5. The persistence boundary - `commitSessions`, `app.js:52-62`, called from `completeSession:139`, `editSession:161` and `deleteSession:169`.** One function, one `localStorage.setItem` of the whole array, for all three write paths. `state.sessions = next` is line 60, *after* the write returned. Note the asymmetry this function forced the callers to think about: `completeSession` resets the timer whether or not the write succeeded, because the minute really elapsed, while `deleteSession` does nothing at all on failure. Same boundary, two different product answers, both explicit.

**6. Publication and render - `renderTimer:176`, `renderSessions:184`, `renderTodayTotal:215`.** Everything on screen is derived per render: the clock text from `timer.remaining` (rounded up only here, `app.js:177`), the status label and button caption from `timer.mode`, the session count from the array length, and today's total by re-filtering the whole log on `toDateString()`. There is no cached total to go stale. Ask the last question: what does a repeated call do? All three render functions are idempotent; `completeSession` is not, and layer 3 is what makes the second call harmless.

Now trace a failure backwards. Patch `Storage.prototype.setItem` to throw and let a session complete (test 4). Which layer observed the failure? Five. Which layers had *already finished* and cannot be undone? Three - the timer left `running` at `app.js:126` before the write was attempted, and the interval was cleared. That is why the message is "Session complete, but it could not be saved" rather than "Could not save": layer 3's transition is real and irreversible, and only layer 5's effect is missing. Compare with test 5, where a failing delete leaves every layer unchanged. Being able to say which layers committed before the failure is the whole skill.
