# Habit Tracker - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. State is `{ habits, editingId }`.
> Each habit is `{ id, name, color, history }` where `history` is a map of
> `"YYYY-MM-DD" -> true`. `render()` draws a 7-day grid per habit via
> `lastNDays(WEEK_LENGTH)` and `toggleDay()`. `currentStreak()` counts back from
> today. `isoDate()` formats local dates. Persists to `localStorage`.

---

## Story 1: Show the longest (best) streak
**As a** user, **I want** to see my best streak, **so that** I stay motivated.

### Acceptance criteria
- [ ] Each habit shows "Best: N" next to the current streak badge.
- [ ] Best streak is computed from the full `history`, not just the visible week.

### Implementation plan
1. **`app.js`** - add `function bestStreak(habit){ const days = Object.keys(habit.history).filter(d=>habit.history[d]).sort(); let best=0, run=0, prev=null; for(const d of days){ const cur=new Date(d+"T00:00:00"); run = (prev && (cur-prev)===86400000) ? run+1 : 1; best=Math.max(best,run); prev=cur; } return best; }`.
2. **`render()`** - where the `.streak-badge` is built, append a second badge showing `Best: ${bestStreak(habit)}`.

### How to test
Mark several consecutive days then a gap then more days; confirm "Best" equals the longest consecutive run, independent of the current streak.

---

## Story 2: Toggle between 7-day and 30-day views
**As a** user, **I want** a monthly view, **so that** I can see longer trends.

### Acceptance criteria
- [ ] A toggle switches the grid between 7 and 30 days.
- [ ] The weekly completion percentage label updates to match the chosen window.
- [ ] The choice persists across reloads.

### Implementation plan
1. **`app.js`** - replace the constant `WEEK_LENGTH` usage with a `state.windowDays` (default 7), loaded from localStorage.
2. **`index.html`** - add a toggle (two buttons or a select: 7 / 30).
3. **`render()`** - use `lastNDays(state.windowDays)`; the existing `done/possible` math already uses the window length, so the percentage updates automatically. For 30 days, consider smaller cells via a CSS class on `.day-grid`.
4. **`renderSummary()`** - already multiplies by window length; verify it uses `state.windowDays`.

### How to test
Switch to 30 days, confirm 30 cells render and the percentages recompute; reload and confirm the view is remembered.

---

## Story 3: Reorder habits
**As a** user, **I want** to move habits up/down, **so that** my most important ones are on top.

### Acceptance criteria
- [ ] Each habit row has up/down buttons; the top item's up button and bottom item's down button are disabled.
- [ ] The new order persists across reloads.

### Implementation plan
1. **`app.js`** - add `function moveHabit(id, dir){ const i = state.habits.findIndex(h=>h.id===id); const j=i+dir; if(j<0||j>=state.habits.length) return; [state.habits[i],state.habits[j]]=[state.habits[j],state.habits[i]]; saveHabits(); render(); }`.
2. **`render()`** - in `.habit-footer` controls, add -/- buttons wired to `moveHabit(habit.id, -1)` / `(+1)` and disable at the ends using the habit's index.

### How to test
Reorder a few habits, reload, confirm the order sticks.

---

## Story 4: Per-day note on a cell
**As a** user, **I want** to attach a note to a day, **so that** I can record context.

### Acceptance criteria
- [ ] Right-click (or long-press) a day cell prompts for a note stored per date.
- [ ] Cells with a note show a small dot indicator; hovering shows the note as a tooltip.
- [ ] Notes persist alongside the habit.

### Implementation plan
1. **`app.js`** - add a `notes` map to each habit (`habit.notes = habit.notes || {}`), keyed by ISO date.
2. **`render()`** - on each cell add a `contextmenu` listener: `e.preventDefault(); const text = prompt("Note for "+iso, habit.notes[iso]||""); if(text===null) return; if(text) habit.notes[iso]=text; else delete habit.notes[iso]; saveHabits(); render();`.
3. **`render()`** - set `cell.title = habit.notes[iso] || ""` and add a `.has-note` class when a note exists.
4. **`styles.css`** - add a small `::after` dot for `.day-cell.has-note`.

### How to test
Right-click a cell, add a note, confirm the dot and tooltip; clear the note and confirm the dot disappears; reload persists.

---

## Story 5: Daily completion ring
**As a** user, **I want** to see today's overall completion, **so that** I know if I'm done for the day.

### Acceptance criteria
- [ ] A header shows "X / N habits done today" with a circular or bar progress indicator.
- [ ] It updates instantly when any cell for today is toggled.

### Implementation plan
1. **`index.html`** - add a `<div id="today-ring">` in the form panel header area.
2. **`app.js`** - add `function renderTodayRing(){ const today = isoDate(startOfToday()); const done = state.habits.filter(h=>h.history[today]).length; const total = state.habits.length; const pct = total ? Math.round(done/total*100) : 0; /* set conic-gradient or width */ }`.
3. **`render()`** - call `renderTodayRing()` so it stays in sync with toggles.
4. **`styles.css`** - implement the ring with `background: conic-gradient(var(--brand) ${pct}%, #eef2f8 0)` on a round element (set the pct via an inline style or CSS variable).

### How to test
Toggle today's cells on several habits, confirm the ring/label updates immediately and matches the count.

