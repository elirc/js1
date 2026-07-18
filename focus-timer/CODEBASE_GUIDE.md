# Focus Timer Codebase Guide

This project teaches timing, intervals, and lifecycle cleanup. Those skills transfer to polling dashboards, autosave, animations, and real-time UI.

## Code Map

- `index.html`: timer display, controls, session log.
- `styles.css`: timer layout, log cards, responsive styling.
- `app.js`: timer state machine, interval management, session CRUD.

## Timer State

```js
const timer = {
  mode: "idle",
  intervalId: null,
  remainingSeconds: configuredSeconds(),
  startedAt: null
};
```

This object models a small state machine. `mode` tells the UI what actions are allowed; `intervalId` lets the code clean up work.

## Avoid Stacked Intervals

```js
function pauseTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.mode = "paused";
  renderTimer();
}
```

Any code that starts background work must also stop it. In production React, this same idea appears in `useEffect` cleanup functions.

## Logging Completed Sessions

```js
state.sessions.unshift({
  id: crypto.randomUUID(),
  label: labelInput.value.trim() || "Focus session",
  minutes: Number(minutesInput.value),
  completedAt: new Date().toISOString()
});
```

A completed timer becomes a record. That is the CRUD part of the app: create a session, render sessions, delete sessions, persist sessions.

## Derived Daily Total

```js
const todayMinutes = state.sessions
  .filter((session) => session.completedAt.startsWith(todayKey))
  .reduce((sum, session) => sum + session.minutes, 0);
```

This is analytics over app data. Instead of storing "today total", compute it from source records.

## Extension Practice

- Add pause duration tracking.
- Add session categories.
- Add a weekly summary.
- Add browser notifications.
- Convert timer state transitions into named functions.

When debugging timer bugs, log mode changes and interval IDs. Most issues come from lifecycle mistakes.
