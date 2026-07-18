# Snippet Vault - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** this app is split across **ES modules** in `src/`.
> `store.js` owns the data + every mutation (exports `listSnippets`,
> `saveSnippet`, `deleteSnippet`, `getSnippet`) and persists to `localStorage`.
> `dom.js` has pure render helpers (`buildCard`, `copyToClipboard`). `main.js`
> wires DOM events to the store and re-renders. **Rule of thumb:** data changes
> go in `store.js`, rendering in `dom.js`, event wiring in `main.js`. Snippet
> fields: `id, title, language, tags[], code, createdAt`.

---

## Story 1: Favorite snippets and filter to favorites
**As a** user, **I want** to star snippets, **so that** I find my go-to ones fast.

### Acceptance criteria
- [ ] Each card has a star toggle; the state persists.
- [ ] A "Favorites only" toggle filters the list (combined with search/language).

### Implementation plan
1. **`store.js`** - add `favorite: false` to `starterSnippets` and to the object created in `saveSnippet`. Add and export `function toggleFavorite(id){ snippets = snippets.map(s => s.id===id ? {...s, favorite:!s.favorite} : s); persist(); }`. Extend `listSnippets({ query, language, favoritesOnly })` to filter `&& (!favoritesOnly || snippet.favorite)`.
2. **`dom.js`** - in `buildCard`, add a star button to the actions and call a passed-in `handlers.onToggleFavorite(snippet.id)`.
3. **`main.js`** - import `toggleFavorite`, add `view.favoritesOnly = false`, pass `onToggleFavorite` in the handlers object, add the favorites checkbox listener, and include `favoritesOnly` in the `view` passed to `listSnippets`.
4. **`index.html`** - add the "Favorites only" checkbox to the toolbar.

### How to test
Star two snippets, toggle "Favorites only", confirm only starred show and the state survives reload.

---

## Story 2: Sort snippets
**As a** user, **I want** to sort by newest or title, **so that** I can scan the library.

### Acceptance criteria
- [ ] A "Sort" dropdown offers Newest and Title (A-Z).
- [ ] Sorting combines with the existing filters.

### Implementation plan
1. **`store.js`** - accept `sort` in `listSnippets({ ..., sort })` and append a `.sort()`: `title` -> `localeCompare`; `recent` -> compare `createdAt` descending (ISO strings compare lexically).
2. **`main.js`** - add `view.sort = "recent"`, wire the dropdown's `change`, include `sort` in the `view`.
3. **`index.html`** - add `<select id="sort-select">`.

### How to test
Add snippets over time, switch to Title, confirm alphabetical order; switch to Newest, confirm most-recent first.

---

## Story 3: Track and surface usage count
**As a** user, **I want** copies counted, **so that** my most-used snippets are easy to find.

### Acceptance criteria
- [ ] Copying a snippet increments its `uses` count (persisted).
- [ ] The card shows "Used N times".
- [ ] Sorting by "Most used" is available.

### Implementation plan
1. **`store.js`** - add `uses: 0` to new snippets; add/export `function recordUse(id){ snippets = snippets.map(s => s.id===id ? {...s, uses:(s.uses||0)+1} : s); persist(); }`. Add a `mostUsed` branch to the `sort` in `listSnippets` (`(b.uses||0)-(a.uses||0)`).
2. **`main.js`** - in `copySnippet`, after a successful `copyToClipboard`, call `recordUse(snippet.id)` then `render()`.
3. **`dom.js`** - in `buildCard`, render `Used ${snippet.uses ?? 0} times`.
4. **`index.html`** - add "Most used" to the sort dropdown from Story 2.

### How to test
Copy a snippet 3 times, confirm "Used 3 times", sort by Most used, confirm it rises to the top.

---

## Story 4: Export and import the whole library
**As a** user, **I want** to back up snippets, **so that** I can move them between machines.

### Acceptance criteria
- [ ] "Export" downloads `snippets.json`.
- [ ] "Import" merges a valid file (skipping duplicate ids) and re-renders.
- [ ] Invalid files show an error and change nothing.

### Implementation plan
1. **`store.js`** - add/export `function exportAll(){ return JSON.stringify(snippets, null, 2); }` and `function importAll(json){ const parsed = JSON.parse(json); if(!Array.isArray(parsed)) throw new Error("Expected an array"); const existing = new Set(snippets.map(s=>s.id)); for(const s of parsed){ if(!existing.has(s.id)) snippets.push(s); } persist(); }`.
2. **`main.js`** - wire an Export button (Blob download of `exportAll()`) and an Import `<input type="file">` that reads the file text and calls `importAll` in a try/catch, showing a message and calling `render()`.
3. **`index.html`** - add the Export button and file input.

### How to test
Export, add a snippet, import the old file, confirm no duplicates and the imported ones reappear; import garbage and confirm the error.

---

## Story 5: Line numbers in the code preview
**As a** user, **I want** line numbers, **so that** I can reference specific lines.

### Acceptance criteria
- [ ] Each rendered snippet shows a left gutter of line numbers aligned to the code.
- [ ] Numbers update with the code content and don't break copy (Story 3 still copies only the code).

### Implementation plan
1. **`dom.js`** - in `buildCard`, wrap the `<pre><code>` in a `<div class="code-wrap">` and prepend a `<div class="gutter">` whose text is `snippet.code.split("\n").map((_,i)=>i+1).join("\n")`.
2. **`dom.js`** - keep `copyToClipboard(snippet.code)` using the raw code field (not the DOM) so line numbers never leak into the copy.
3. **`styles.css`** - lay out `.code-wrap { display:grid; grid-template-columns:auto 1fr }`; style `.gutter` as a muted monospace column with the same line-height as the code.

### How to test
Save a multi-line snippet, confirm the gutter numbers align with each line; copy and paste, confirm no numbers are included.

