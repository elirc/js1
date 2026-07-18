# Contact Book - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. Data is the module-level
> `contacts` array (fields: `id, name, email, phone, company, relationship`),
> plus `editingId` and `searchTerm`. `renderContacts()` rebuilds from
> `getFilteredContacts()`; `saveContact` creates/updates; `persistContacts()`
> writes to `localStorage` under `STORAGE_KEY`. Markup in `index.html`.

---

## Story 1: Favorite contacts and filter to favorites
**As a** user, **I want** to star important contacts, **so that** I can reach them fast.

### Acceptance criteria
- [ ] Each card has a star toggle that persists.
- [ ] A "Favorites only" toggle filters the list.
- [ ] Favorites sort to the top when shown with everyone.

### Implementation plan
1. **`app.js`** - add `favorite: false` to `sampleContacts` items and to the object built in `saveContact`.
2. **`app.js`** - add `let favoritesOnly = false;`. Add `function toggleFavorite(id)` that flips `contact.favorite`, calls `persistContacts()` and `renderContacts()`.
3. **`renderContacts()`** - add a `...`/`` button to each card wired to `toggleFavorite(contact.id)`.
4. **`getFilteredContacts()`** - add `&& (!favoritesOnly || contact.favorite)`, and `.sort((a,b)=> Number(b.favorite) - Number(a.favorite))` at the end.
5. **`index.html`** - add a `<label><input type="checkbox" id="favorites-only">Favorites only</label>` and wire its `change` to set `favoritesOnly` and re-render.

### How to test
Star two contacts, enable "Favorites only", confirm only starred show; disable and confirm starred float to the top.

---

## Story 2: Filter by relationship
**As a** user, **I want** to filter by relationship, **so that** I can see just Clients or Colleagues.

### Acceptance criteria
- [ ] A dropdown lists "All" plus each relationship value.
- [ ] Selecting one narrows the list and combines with the search box.

### Implementation plan
1. **`index.html`** - add `<select id="relationship-filter">` near the search input.
2. **`app.js`** - add `let relationshipFilter = "All";` and populate the select options from the relationship values used in the form (Colleague, Client, Friend, Family - match your `index.html` form options).
3. **`app.js`** - add a `change` listener that sets `relationshipFilter` and re-renders.
4. **`getFilteredContacts()`** - add `&& (relationshipFilter === "All" || contact.relationship === relationshipFilter)`.

### How to test
Add contacts with different relationships, pick "Client", confirm only Clients show and search still narrows further.

---

## Story 3: Validate email and phone with inline errors
**As a** user, **I want** clear validation, **so that** I don't save bad data.

### Acceptance criteria
- [ ] Saving with an invalid email shows "Enter a valid email" under the email field.
- [ ] Saving with a phone shorter than 7 digits shows a phone error.
- [ ] Errors clear when corrected and the contact saves.

### Implementation plan
1. **`index.html`** - add empty `<small class="field-error" id="email-error">` and `id="phone-error"` beneath each field.
2. **`app.js`** - in `saveContact`, before building the object, run checks: `const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)`, `const phoneDigits = phone.replace(/\D/g,"")`. Set the corresponding error element's `textContent` and `return` early if invalid.
3. **`app.js`** - clear both error elements at the start of `saveContact` and in `resetForm`.
4. **`styles.css`** - add `.field-error { color: var(--danger); font-size:.8rem; }`.

### How to test
Submit `bad-email` -> email error; submit `123` phone -> phone error; fix both -> contact saves.

---

## Story 4: Sort contacts
**As a** user, **I want** to sort by name or company, **so that** I can scan the directory.

### Acceptance criteria
- [ ] A "Sort" dropdown offers Name (A-Z) and Company (A-Z).
- [ ] The list re-sorts immediately and the choice persists across reloads.

### Implementation plan
1. **`index.html`** - add `<select id="sort-select">` with `value="name"` and `value="company"`.
2. **`app.js`** - add `let sortMode = localStorage.getItem("js1-contact-sort") || "name";`, set the select's value on load, and on `change` update `sortMode`, persist it, re-render.
3. **`getFilteredContacts()`** - append `.sort((a,b)=> (a[sortMode]||"").localeCompare(b[sortMode]||""))`.

### How to test
Switch between Name and Company, reload, confirm the choice and order persist.

---

## Story 5: Export contacts to CSV
**As a** user, **I want** to export contacts as CSV, **so that** I can use them elsewhere.

### Acceptance criteria
- [ ] An "Export CSV" button downloads `contacts.csv` with a header row and one row per contact.
- [ ] Fields containing commas or quotes are quoted/escaped correctly.

### Implementation plan
1. **`index.html`** - add `<button id="export-csv">`.
2. **`app.js`** - add `function csvCell(v){ const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }`.
3. **`app.js`** - build CSV: header `["name","email","phone","company","relationship"]`, then map `contacts` to rows of `csvCell`, join cells with `,` and rows with `\n`.
4. **`app.js`** - download via Blob + temporary `<a download="contacts.csv">` (Blob type `text/csv`), then `URL.revokeObjectURL`.

### How to test
Add a contact with a comma in the company name, export, open the CSV, confirm the field is quoted and all rows present.

