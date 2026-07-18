# Pantry Inventory - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. Data is the `items` array
> (fields: `id, name, category, quantity, minimum, expires`), plus `editingId`,
> `searchTerm`, `activeFilter` (`All`/`Low`/`Fresh`). The table body `#items` is
> rebuilt by `renderItems()` from `getVisibleItems()`. `persistItems()` writes to
> `localStorage`. "Low" = `quantity <= minimum`.

---

## Story 1: Flag items expiring soon
**As a** user, **I want** items near their expiration highlighted, **so that** I use them first.

### Acceptance criteria
- [ ] Items expiring within 7 days show an amber "Expiring" tag; already-expired show red "Expired".
- [ ] A summary counter shows how many items are expiring within 7 days.

### Implementation plan
1. **`app.js`** - add `function expiryState(item)` returning `"expired" | "soon" | "ok"`: compute `days = Math.ceil((new Date(item.expires+"T00:00:00") - startOfToday())/86400000)`; `<0` -> expired, `<=7` -> soon. Add a `startOfToday()` helper.
2. **`renderItems()`** - in the row template, add a `<span class="status expiry">` and set its text/class from `expiryState(item)`.
3. **`index.html`** - add a summary stat next to `#low-items`, e.g. `<span id="expiring-items">`.
4. **`renderItems()`** - set `expiringItems.textContent = items.filter(i => expiryState(i) === "soon").length`.
5. **`styles.css`** - add `.expiry.soon { color: var(--warn) }` and `.expiry.expired { color: var(--danger) }` (reuse existing `.status` styling).

### How to test
Add an item expiring in 3 days -> amber; one dated yesterday -> red; check the counter.

---

## Story 2: Quick +/- quantity buttons in each row
**As a** user, **I want** to adjust stock inline, **so that** I don't open the edit form for small changes.

### Acceptance criteria
- [ ] Each row has "'" and "+" buttons that change `quantity` by 1.
- [ ] Quantity never goes below 0; changes persist and re-render (low status updates live).

### Implementation plan
1. **`app.js`** - add `function adjustQuantity(id, delta){ const item = items.find(i=>i.id===id); if(!item) return; item.quantity = Math.max(0, item.quantity + delta); persistItems(); renderItems(); }`.
2. **`renderItems()`** - in the quantity cell, render two buttons wired to `adjustQuantity(item.id, -1)` and `(+1)`. Keep the `data-action='edit'`/`delete` buttons.
3. **`styles.css`** - add small `.qty-btn` styling.

### How to test
Click "+" several times; click "'" past 0 (stays at 0); confirm the Low/Fresh status flips when crossing the minimum and survives reload.

---

## Story 3: Filter by category
**As a** user, **I want** to filter by category, **so that** I can review one section of the pantry.

### Acceptance criteria
- [ ] A category dropdown lists "All" plus the distinct categories in the data.
- [ ] It combines with the existing search box and Low/Fresh filter.

### Implementation plan
1. **`index.html`** - add `<select id="category-filter">`.
2. **`app.js`** - add `let categoryFilter = "All";`. Add `function categories(){ return ["All", ...new Set(items.map(i=>i.category))]; }` and a `function renderCategoryOptions()` that rebuilds the select; call it inside `renderItems()` so new categories appear.
3. **`app.js`** - `change` listener sets `categoryFilter` and re-renders.
4. **`getVisibleItems()`** - add `&& (categoryFilter === "All" || item.category === categoryFilter)`.

### How to test
Add items in two categories, pick one, confirm the table narrows and the Low filter still applies on top.

---

## Story 4: Sortable table columns
**As a** user, **I want** to sort by name, quantity, or expiration, **so that** I can prioritize.

### Acceptance criteria
- [ ] Clicking a column header sorts by it; clicking again reverses direction.
- [ ] An arrow indicator shows the active column and direction.

### Implementation plan
1. **`app.js`** - add `let sortKey = "name", sortDir = 1;`.
2. **`index.html`** - make the relevant `<th>` cells buttons or add a `data-sort` attribute (`name`, `quantity`, `expires`).
3. **`app.js`** - attach a click handler to the header row: if the clicked key equals `sortKey`, flip `sortDir`; else set `sortKey` and `sortDir = 1`; then `renderItems()`.
4. **`getVisibleItems()`** - append a `.sort()` comparing by `sortKey` (numeric for `quantity`, `localeCompare` for `name`, date compare for `expires`) multiplied by `sortDir`.
5. **`renderItems()`** - append `-`/`-` to the active header.

### How to test
Click "Quantity" twice and confirm ascending then descending; the arrow tracks the active column.

---

## Story 5: Export a shopping list of low items
**As a** user, **I want** a list of items at/below their minimum, **so that** I know what to buy.

### Acceptance criteria
- [ ] A "Copy shopping list" button copies low items to the clipboard as text.
- [ ] Each line reads `Name - need X` where X = `minimum - quantity + 1` (at least 1).
- [ ] A toast/message confirms the copy.

### Implementation plan
1. **`index.html`** - add `<button id="shopping-list">`.
2. **`app.js`** - build `const low = items.filter(i => i.quantity <= i.minimum); const text = low.map(i => \`${i.name} - need ${Math.max(1, i.minimum - i.quantity + 1)}\`).join("\n");`.
3. **`app.js`** - `await navigator.clipboard.writeText(text)` (guard with `if (navigator.clipboard)`), then `setMessage("Shopping list copied.")`.
4. Edge case: if `low.length === 0`, set a message "Nothing is low" and skip copying.

### How to test
Set an item's quantity below its minimum, click the button, paste into a note, confirm the line and quantity.

