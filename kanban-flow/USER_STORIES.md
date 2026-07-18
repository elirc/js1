# Kanban Flow - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. `COLUMNS` is a fixed array
> (`todo/doing/done`). State is `{ cards, draggingId }`; each card is
> `{ id, title, column, order }`. `render()` rebuilds columns from
> `cardsIn(columnId)`; native drag-and-drop uses `dragstart/dragover/drop`;
> `moveCard()` re-inserts and renumbers `order`. Persists to `localStorage`.

---

## Story 1: Enforce a WIP limit per column
**As a** user, **I want** a work-in-progress cap, **so that** columns don't overflow.

### Acceptance criteria
- [ ] Each column has a configurable limit (default: Doing = 3, others unlimited).
- [ ] Dropping a card into a full column is blocked and shows a brief message.
- [ ] The column header shows `count / limit` and turns red when at the limit.

### Implementation plan
1. **`app.js`** - add a `limit` to each `COLUMNS` entry (e.g. `{ id:"doing", title:"Doing", limit:3 }`).
2. **`moveCard(columnId, beforeId)`** - at the top, if the card is changing columns and `column.limit` is set and `cardsIn(columnId).length >= limit`, call `showMessage("Doing is full")` and `return` without moving. (Add a `showMessage` helper writing to `#form-message`.)
3. **`render()`** - show `count`/`limit` in the header and add an `at-limit` class when `count >= limit`.
4. **`styles.css`** - style `.column.at-limit .count`.

### How to test
Fill Doing to its limit, drag another card in, confirm it's blocked with a message and the header shows red.

---

## Story 2: Card descriptions
**As a** user, **I want** to add details to a card, **so that** I capture more than a title.

### Acceptance criteria
- [ ] Cards can store a multi-line `description`.
- [ ] A card with a description shows a " indicator; clicking the card body expands/collapses the description.
- [ ] Editing prompts for both title and description.

### Implementation plan
1. **`app.js`** - add `description: ""` when creating cards in `handleAdd`. In `renameCard(id)`, after the title prompt, also `prompt("Description", card.description)` and store it.
2. **`buildCard(card)`** - when `card.description`, render a hidden `<p class="card-desc">` and a " marker; toggle a `.expanded` class on click of the card body (guard so the action buttons still `stopPropagation`).
3. **`styles.css`** - `.card-desc { display:none } .card.expanded .card-desc { display:block }`.

### How to test
Add a description via Edit, confirm the marker appears and clicking expands/collapses it; reload persists the text.

---

## Story 3: Color labels on cards
**As a** user, **I want** to color-code cards, **so that** I can see categories at a glance.

### Acceptance criteria
- [ ] When adding/editing, I can pick a label color (none/teal/amber/rose/indigo).
- [ ] The card shows a colored left border matching the label.

### Implementation plan
1. **`index.html`** - add a `<select id="card-label">` to the quick-add form.
2. **`app.js`** - store `label: labelInput.value` on create; allow changing it in `renameCard` (or a dedicated prompt).
3. **`buildCard`** - add class `label-${card.label}` to the card element.
4. **`styles.css`** - add `.card.label-teal { border-left:4px solid #1b6f68 }` etc.

### How to test
Create cards with different labels, confirm the colored borders; edit a card's label and confirm it updates.

---

## Story 4: Add and rename columns
**As a** user, **I want** to manage columns, **so that** the board fits my workflow.

### Acceptance criteria
- [ ] An "Add column" control creates a new column (slug + title).
- [ ] Columns persist across reloads (not just the hard-coded three).
- [ ] Existing cards keep their column; deleting a column is blocked while it has cards.

### Implementation plan
1. **`app.js`** - move `COLUMNS` from a constant into state: `let columns = JSON.parse(localStorage.getItem("js1-kanban-cols")||"null") || [ {id:"todo",title:"To Do"}, ... ]` with a `saveColumns()`.
2. **`index.html`** - add an "Add column" button; on click `prompt` for a title, derive an `id` slug, push to `columns`, save, re-render.
3. **`render()`** - iterate `columns` instead of the constant. Add a small "rename"/"delete" control per column header; deletion checks `cardsIn(id).length === 0` first.
4. **`#card-column` select** - rebuild its options from `columns` on each render so new columns are choosable.

### How to test
Add a "Review" column, move cards into it, reload (it persists), try to delete a non-empty column (blocked), empty it, delete it.

---

## Story 5: Search and filter cards
**As a** user, **I want** to filter the board, **so that** I can focus on matching cards.

### Acceptance criteria
- [ ] A search box dims/hides cards whose title (or description) doesn't match.
- [ ] Column counts reflect only matching cards while a query is active.
- [ ] Clearing the box restores everything.

### Implementation plan
1. **`index.html`** - add `<input type="search" id="card-search">` in the header.
2. **`app.js`** - add `state.query = ""`; wire the input to set it (lowercased) and re-render.
3. **`cardsIn(columnId)`** - after filtering by column, also filter by `state.query` against `title` (+ `description` if Story 2 is built). The header count then naturally reflects matches.

### How to test
Type a term, confirm only matching cards remain and counts drop; clear the box and confirm all cards return. (Note: dragging while filtered still updates `order` correctly because `moveCard` operates on the full data.)

