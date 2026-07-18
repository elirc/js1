# Habit Tracker Codebase Guide

This app teaches dates, boolean grids, and derived streaks. Production apps use similar patterns for attendance, compliance checklists, and recurring tasks.

## Code Map

- `index.html`: habit form, summary, habit list.
- `styles.css`: week grid, color indicators, responsive cards.
- `app.js`: CRUD, date generation, toggles, streak calculations.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  name: "Read documentation",
  color: "#2f6b3f",
  completions: {}
}
```

`completions` is an object keyed by date. That makes toggling one day cheap and readable.

## Toggling a Date

```js
habit.completions[dateKey] = !habit.completions[dateKey];
```

This is a boolean map. It is simpler than storing an array of completed dates when you often need to check one specific day.

## Derived Streak

```js
let streak = 0;
for (const dateKey of getLastSevenDays()) {
  if (!habit.completions[dateKey]) break;
  streak += 1;
}
```

Derived calculations should be easy to read. If a business rule gets more complex, extract it to a named function and add tests.

## Date Boundaries

Dates are surprisingly hard in production because time zones matter. This project uses local date strings for simplicity. A corporate app should document whether dates are local user dates, UTC dates, or business-location dates.

## Extension Practice

- Store a target frequency per week.
- Add monthly calendar rendering.
- Add archived habits.
- Add notes per completion.
- Move date helpers into `dates.js`.

When changing date logic, test around midnight and across time zones if the app becomes server-backed.
