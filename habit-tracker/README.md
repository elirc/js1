# Habit Tracker CRUD

A vanilla JavaScript habit tracker for practicing:

- Working with dates (building the last 7 days in local time)
- Computing a derived value: the current consecutive-day streak
- Toggling boolean state in a grid of cells
- Aggregating weekly completion across all habits
- CRUD on habits with localStorage persistence

## Why this project

Every other vanilla app stores flat records. This one stores a `history`
map of `YYYY-MM-DD -> true` per habit, so the interesting logic is in the
date math and derived stats rather than the form.

## Things to try

1. Trace `currentStreak` and `lastNDays` and make sure the date handling
   stays in local time.
2. Extend the grid from 7 days to a 30-day view.
3. Add a "best streak" stat alongside the current streak.

Open `index.html` in a browser to run it.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): local dates, derived statistics and edge cases, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
