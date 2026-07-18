# Note Vault

A React + Node CRUD project where the server **persists data to disk** with
`fs/promises` instead of keeping it in memory. Restart the server and your
notes are still there.

## Learning goals

- Read and write a JSON file with `node:fs/promises`
- Seed the data file on first run by catching `ENOENT`
- Make sure the `data/` directory exists with `mkdir({ recursive: true })`
- Treat the file as the source of truth: every mutation rewrites it
- Add a `PATCH` route (pin/unpin) alongside the usual CRUD verbs

## How it differs from issue-desk

`issue-desk` stores records in a module-level array that resets on every
restart. Here the repository functions are `async` because each one reads the
file, mutates, and writes it back. The data lives in `server/data/notes.json`,
which is created automatically.

## Suggested build order

1. Read `server/server.js` and trace `readAll` / `writeAll`.
2. Delete `server/data/notes.json` and restart — watch it re-seed.
3. Notice the trade-off: rewriting the whole file is simple but doesn't scale.
   Try swapping in SQLite as the next step.

## Stretch ideas

- Debounce writes so rapid edits don't thrash the disk
- Add an `archived` flag and a filter for it
- Replace the JSON file with SQLite (`better-sqlite3`)
