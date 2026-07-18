# Note Vault - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4106**) that
> **persists to disk** via `fs/promises` in a `createNoteRepository(file)` with
> async `list/create/update/togglePin/remove` (rewriting `server/data/notes.json`
> each mutation; seeds on `ENOENT`). Note fields: `id, title, body, pinned,
> updatedAt`. React client in `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Tag notes and filter by tag
**As a** user, **I want** tags, **so that** I can organize notes.

### Acceptance criteria
- [ ] Notes store a `tags` array; the create/edit form accepts comma-separated tags.
- [ ] Tags render as chips; a tag filter (`?tag=`) narrows the list server-side.

### Implementation plan
1. **`server/server.js`** - in `validateNote` allow optional tags; in repository `create`/`update`, set `tags: Array.isArray(input.tags) ? input.tags.map(t=>String(t).trim().toLowerCase()).filter(Boolean) : []`. Default existing notes' missing `tags` to `[]` when reading.
2. **`server/server.js`** - in `list({ search, tag })`, also filter `&& (!tag || note.tags?.includes(tag))`.
3. **`client/src/api.js`** - `listNotes(filters)` already serializes filters; pass `{ search, tag }`.
4. **`client/src/App.jsx`** - add a tags input; render chips; clicking a chip sets a `tag` filter.

### How to test
Tag a note `work, urgent`, filter by `work`, confirm only matching notes load and the file shows the tags.

---

## Story 2: Archive notes
**As a** user, **I want** to archive notes, **so that** old ones leave my main view without deleting.

### Acceptance criteria
- [ ] `PATCH /api/notes/:id/archive` toggles an `archived` flag (persisted to disk).
- [ ] The default list hides archived notes; an "Archived" view shows only them.

### Implementation plan
1. **`server/server.js`** - add `archived: false` on create; add a `toggleArchive(id)` repo method (mirror `togglePin`) and a `PATCH /api/notes/:id/archive` route.
2. **`server/server.js`** - in `list`, accept `includeArchived`/`archivedOnly` query flags; default excludes `archived` notes.
3. **`client/src/api.js`** + **`App.jsx`** - add `toggleArchive(id)`, an archive button per card, and an "Archived" tab that flips the query.

### How to test
Archive a note, confirm it leaves the main list and appears under "Archived"; restart the server and confirm the flag persisted.

---

## Story 3: Sort notes
**As a** user, **I want** to sort, **so that** I can find recent or alphabetical notes.

### Acceptance criteria
- [ ] A sort control offers Updated (newest) and Title (A-Z); pinned notes always lead.
- [ ] Sorting happens server-side.

### Implementation plan
1. **`server/server.js`** - the repo already sorts pinned-first by `updatedAt`; extend `list` to accept `sort` and, within the non-pinned ordering, switch between `updatedAt` desc and `title` `localeCompare`. Keep pinned grouping on top.
2. **`client/src/App.jsx`** - add a `sort` `<select>` and include it in the filters object.

### How to test
Create several notes, switch to Title, confirm A-Z within each pinned/unpinned group.

---

## Story 4: Debounced autosave while editing
**As a** user, **I want** edits saved automatically, **so that** I don't lose work.

### Acceptance criteria
- [ ] While editing an existing note, changes save ~800ms after typing stops (no Save click needed).
- [ ] A subtle "Saving.../Saved" status shows.
- [ ] Rapid keystrokes collapse into one network write (debounced).

### Implementation plan
1. **`client/src/App.jsx`** - add a `useEffect` watching `form` while `editingId` is set: start a `setTimeout(800)` that calls `updateNote(editingId, form)` and sets a status; clear the timeout on each change (cleanup function). This naturally debounces.
2. **`client/src/App.jsx`** - show a `status` string ("Saving...", then "Saved HH:MM").
3. **Server note:** the repo rewrites the whole file per write; debouncing keeps that from thrashing the disk on every keystroke (call this out for the reader).

### How to test
Edit a note's body, stop typing, confirm one network call after ~0.8s and a "Saved" status; type quickly and confirm only one write fires.

---

## Story 5: Export all notes as one Markdown file
**As a** user, **I want** a Markdown export, **so that** I can read notes anywhere.

### Acceptance criteria
- [ ] `GET /api/notes/export` returns a single Markdown document (pinned first).
- [ ] Each note becomes `## Title` + body, separated by `---`.
- [ ] The client offers a "Download .md" button.

### Implementation plan
1. **`server/server.js`** - add `GET /api/notes/export`: read all notes (reuse `list({search:""})`), build a string `notes.map(n => \`## ${n.title}\n\n${n.body}\`).join("\n\n---\n\n")`, and respond with `Content-Type: text/markdown` and a `Content-Disposition: attachment; filename="notes.md"` header.
2. **`client/src/App.jsx`** - add a button that opens `http://localhost:4106/api/notes/export` in a new tab (or fetches and triggers a Blob download).

### How to test
Click "Download .md", open the file, confirm pinned notes are first and each note is a `##` section separated by `---`.

