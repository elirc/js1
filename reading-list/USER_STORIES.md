# Reading List - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. Data is the `books` array
> (fields: `id, title, author, status, rating, notes`), plus `editingId`,
> `searchTerm`, `sortMode`. `renderBooks()` rebuilds from `getVisibleBooks()`,
> which filters then sorts. `persistBooks()` writes to `localStorage`.

---

## Story 1: Clickable star rating widget
**As a** user, **I want** to set a rating by clicking stars, **so that** rating is faster than a dropdown.

### Acceptance criteria
- [ ] The form shows 5 clickable stars; clicking the Nth sets `rating` to N.
- [ ] Clicking the current rating again clears it to 0.
- [ ] Each card shows filled/empty stars instead of "N / 5" text.

### Implementation plan
1. **`index.html`** - replace the rating `<select>` with `<div id="rating-stars" class="stars">` containing five `<button type="button" data-value="1..5">`. Keep a hidden `<input id="rating">` to stay compatible with `saveBook`.
2. **`app.js`** - add `function paintStars(value){ ... }` that toggles a `.filled` class on the star buttons and sets `ratingInput.value = value`.
3. **`app.js`** - attach a click listener to the star container: read `data-value`, if it equals current `Number(ratingInput.value)` set 0 else that value, then `paintStars`.
4. **`editBook`** - call `paintStars(Number(book.rating))`; **`resetForm`** - call `paintStars(0)`.
5. **`renderBooks()`** - replace the `.rating` text with `"...".repeat(Number(book.rating)) + "".repeat(5 - Number(book.rating))`.
6. **`styles.css`** - style `.stars button` and `.filled`.

### How to test
Click the 4th star -> 4 filled in form and on the saved card; click the 4th again -> cleared.

---

## Story 2: Filter by status with tabs
**As a** user, **I want** status tabs, **so that** I can see only "Reading" or "Finished".

### Acceptance criteria
- [ ] Tabs: All, Want to Read, Reading, Finished. The active tab is highlighted.
- [ ] Choosing a tab filters the list and combines with search/sort.

### Implementation plan
1. **`index.html`** - add a `.tabs` row of buttons with `data-status` values matching your status options plus `All`.
2. **`app.js`** - add `let statusFilter = "All";` and a click handler on the tab container that sets `statusFilter` and re-renders, toggling an `.active` class.
3. **`getVisibleBooks()`** - inside `.filter`, add `&& (statusFilter === "All" || book.status === statusFilter)`.

### How to test
Add books with each status, click "Reading", confirm only those show; search inside the tab still narrows.

---

## Story 3: Track reading progress
**As a** user, **I want** to record current/total pages, **so that** I see a progress bar.

### Acceptance criteria
- [ ] The form has "Current page" and "Total pages" number inputs.
- [ ] Cards show a progress bar = `currentPage / totalPages` (hidden when totals are 0).
- [ ] Setting status to "Finished" fills the bar to 100%.

### Implementation plan
1. **`index.html`** - add `<input type="number" id="current-page">` and `id="total-pages">` to the form.
2. **`app.js`** - in `saveBook`, add `currentPage: Number(currentPageInput.value)||0, totalPages: Number(totalPagesInput.value)||0`. Add these fields to `starterBooks`.
3. **`renderBooks()`** - compute `const pct = book.status === "Finished" ? 100 : (book.totalPages ? Math.round(book.currentPage/book.totalPages*100) : 0)`; render `<div class="progress"><span style="width:${pct}%"></span></div>` only when `book.totalPages > 0` or status is Finished.
4. **`editBook`** - populate both inputs.
5. **`styles.css`** - add `.progress { background:#eef2f8; border-radius:999px; height:8px } .progress span { display:block; height:100%; background: var(--brand); border-radius:999px }`.

### How to test
Set 50/200 pages -> 25% bar; mark Finished -> full bar.

---

## Story 4: Group cards by status
**As a** user, **I want** books grouped under status headings, **so that** the list is organized.

### Acceptance criteria
- [ ] When sort mode is "Group by status", the list shows headings (Want to Read, Reading, Finished) each followed by its books.
- [ ] Empty groups are hidden.

### Implementation plan
1. **`index.html`** - add `<option value="group">Group by status</option>` to the sort `<select>`.
2. **`renderBooks()`** - branch: if `sortMode === "group"`, iterate a fixed status order, filter `getVisibleBooks()` by each status, and for non-empty groups append an `<h3 class="group-heading">` then the cards. Otherwise keep the current flat render. Extract the card-building code into a `function buildBookCard(book)` so both paths reuse it.

### How to test
Switch to "Group by status", confirm headings appear with the right books and empty statuses are omitted.

---

## Story 5: Stats summary panel
**As a** user, **I want** counts and average rating, **so that** I can see my reading at a glance.

### Acceptance criteria
- [ ] A panel shows total books, count per status, and average rating of rated books.
- [ ] It updates after every add/edit/delete.

### Implementation plan
1. **`index.html`** - add a `<section id="stats">` with placeholders.
2. **`app.js`** - add `function renderStats(){ const total = books.length; const byStatus = books.reduce((m,b)=>{m[b.status]=(m[b.status]||0)+1;return m;},{}); const rated = books.filter(b=>Number(b.rating)>0); const avg = rated.length ? (rated.reduce((s,b)=>s+Number(b.rating),0)/rated.length).toFixed(1) : "-"; /* write into #stats */ }`.
3. **`app.js`** - call `renderStats()` at the end of `renderBooks()` so it stays in sync.

### How to test
Add/rate/delete books and confirm totals, per-status counts, and the average update correctly (average ignores unrated books).

