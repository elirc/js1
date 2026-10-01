# Focus Timer CRUD

A vanilla JavaScript Pomodoro-style timer for practicing **time and interval
handling** — the one fundamental the other projects skip.

## What it practices

- Modeling a timer as a small state machine (`idle` / `running` / `paused`)
- Starting and clearing `setInterval` cleanly so timers never stack up
- Formatting seconds into `mm:ss`
- Logging a completed session as a record, then doing CRUD on the log
- Deriving "minutes focused today" from timestamps

## Watch out for

- Always `clearInterval` before starting a new one, and on reset/complete —
  forgetting this is the classic timer bug (multiple intervals running at once).
- The configured length is locked while the timer runs; changing minutes only
  applies from the `idle` state.

## Things to try

1. Add a short-break timer that auto-starts after a focus session.
2. Switch from `setInterval` counting to timestamp math so the timer stays
   accurate even if the tab is throttled in the background.

Open `index.html` in a browser to run it.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): deadlines, delayed callbacks and one-time completion, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
