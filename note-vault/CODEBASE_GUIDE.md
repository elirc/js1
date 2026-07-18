# Note Vault Codebase Guide

Note Vault teaches simple server-side persistence with JSON files. It sits between in-memory demos and real databases.

## Code Map

- `server/server.js`: Express routes plus file read/write helpers.
- `client/src/api.js`: API wrapper.
- `client/src/App.jsx`: note list, search, form state.

## File as Source of Truth

```js
const raw = await readFile(DATA_FILE, "utf8");
return JSON.parse(raw);
```

The app reads notes from disk instead of storing only in memory. That means server restarts do not wipe data.

## First-Run Seeding

```js
if (error.code === "ENOENT") {
  await writeNotes(seedNotes);
  return seedNotes;
}
```

Good apps handle missing initial state. In production, this might be migrations or bootstrap scripts.

## Persistence After Mutation

```js
notes.unshift(note);
await writeNotes(notes);
res.status(201).json(note);
```

The mutation is not complete until persistence succeeds. In real systems, respond after the database confirms the write.

## Client Refresh Pattern

After create/update/delete, the client reloads notes from the server. This is simple and reliable. Later, you can learn optimistic updates, but first master correctness.

## Extension Practice

- Add note tags.
- Add updated timestamps.
- Add debounce to search.
- Add a repository file for data access.
- Replace JSON file persistence with SQLite.

File persistence is educational, but concurrent writes can become risky. That is one reason teams use databases.
