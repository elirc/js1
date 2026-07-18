# Focus Timer - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. The `timer` object is a state
> machine (`mode: idle|running|paused`, `remaining` seconds, `intervalId`).
> `tick()` decrements each second; `completeSession()` logs a finished session
> `{ id, label, minutes, completedAt }` into `state.sessions` and persists.
> `renderTimer()` / `renderSessions()` update the UI. **Always `clearInterval`
> before starting a new one.**

---

## Story 1: Auto-start a break after a focus session
**As a** user, **I want** a break timer to start automatically, **so that** I follow the Pomodoro rhythm.

### Acceptance criteria
- [ ] A "Break minutes" input (default 5) is available.
- [ ] When a focus session completes, a break timer of that length starts automatically and the status reads "Break".
- [ ] Break completion does **not** create a session log entry.

### Implementation plan
1. **`app.js`** - add a `phase` field to `timer` (`"focus" | "break"`), and a `breakInput` element.
2. **`completeSession()`** - after logging the focus session, if not already a break: set `timer.phase = "break"`, `timer.remaining = Number(breakInput.value||5)*60`, and call `startTimer()`; in `startTimer()` skip resetting `remaining` when a phase already set it.
3. **`tick()` / completion** - when `timer.phase === "break"` finishes, do **not** log a session; reset to `phase = "focus"`, `mode = "idle"`, restore the configured focus length.
4. **`renderTimer()`** - show "Focusing..." vs "Break" based on `timer.phase`.

### How to test
Set a 1-minute focus and 1-minute break, run focus to completion, confirm break auto-starts and that finishing the break does not add a log row.

---

## Story 2: Notify on completion (sound + desktop notification)
**As a** user, **I want** to be alerted when the timer ends, **so that** I can switch tasks even in another tab.

### Acceptance criteria
- [ ] On completion, a short beep plays and (if permitted) a desktop notification appears.
- [ ] A "Enable notifications" button requests permission once.
- [ ] If permission is denied, only the beep plays (no errors).

### Implementation plan
1. **`index.html`** - add an "Enable notifications" button.
2. **`app.js`** - on that button, call `Notification.requestPermission()`.
3. **`app.js`** - add `function notifyDone(label){ if (Notification.permission === "granted") new Notification("Time's up", { body: label }); beep(); }` and a `beep()` using the Web Audio API (`new AudioContext()`, an oscillator for ~200ms) - wrap in try/catch.
4. **`completeSession()`** - call `notifyDone(labelInput.value || "Focus session")`.

### How to test
Enable notifications, run a 1-minute timer, confirm the beep and a desktop notification; deny permission and confirm only the beep, no error.

---

## Story 3: Daily focus goal with progress
**As a** user, **I want** a daily minutes goal, **so that** I can track progress toward it.

### Acceptance criteria
- [ ] A goal input (minutes/day) persists in localStorage.
- [ ] A progress bar shows today's logged minutes vs the goal, capping at 100%.
- [ ] Reaching the goal shows a "Goal reached" state.

### Implementation plan
1. **`app.js`** - add `let dailyGoal = Number(localStorage.getItem("js1-focus-goal")) || 120;` and a goal input that saves on change.
2. **`renderTodayTotal()`** - already computes today's minutes; extend it to compute `pct = Math.min(100, Math.round(todayMinutes/dailyGoal*100))` and render a bar plus "Goal reached" when `todayMinutes >= dailyGoal`.
3. **`index.html`** - add a `<div class="goal-bar">` near `#today-total`.

### How to test
Set a 2-minute goal, complete a 2-minute session, confirm the bar fills and shows "Goal reached".

---

## Story 4: Edit a session's minutes (not just rename)
**As a** user, **I want** to correct a session length, **so that** my stats are accurate.

### Acceptance criteria
- [ ] Each session row has an "Edit" action that lets me change label **and** minutes.
- [ ] Invalid minutes (0 or non-numeric) are rejected.
- [ ] Today's total and goal progress update after editing.

### Implementation plan
1. **`app.js`** - replace/extend `editSession(id)`: prompt for label, then prompt for minutes; parse `const m = Math.round(Number(minsStr)); if(!(m>0)) return;` update both fields, `saveSessions()`, `renderSessions()`.
2. **`renderSessions()`** - keep the existing Rename button or relabel it "Edit".

### How to test
Edit a session to 50 minutes, confirm the row and today's total update; try `0` and confirm it's rejected.

---

## Story 5: Weekly stats by day
**As a** user, **I want** a 7-day breakdown, **so that** I see which days I focused most.

### Acceptance criteria
- [ ] A panel shows the last 7 days with total minutes per day as bars.
- [ ] Days with no sessions show as empty bars.

### Implementation plan
1. **`index.html`** - add a `<section id="weekly-stats">`.
2. **`app.js`** - add `function renderWeekly(){ const days=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); days.push(d); } const totals = days.map(d => state.sessions.filter(s => new Date(s.completedAt).toDateString()===d.toDateString()).reduce((sum,s)=>sum+s.minutes,0)); const max = Math.max(1, ...totals); /* render a bar per day at height totals[i]/max*100% with a weekday label */ }`.
3. **`renderSessions()`** - call `renderWeekly()` so it stays current.

### How to test
Log sessions on different days (edit `completedAt` in code or via Story 4), confirm bars scale and empty days show no bar.

