# Contact Book Codebase Guide

This project teaches the core shape of a searchable directory. Company apps use this pattern for customers, employees, vendors, accounts, and admin records.

## Code Map

- `index.html`: form, search input, contact list, empty state.
- `styles.css`: responsive card grid and form layout.
- `app.js`: data loading, CRUD actions, search, render.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  name: "Maya Patel",
  email: "maya@example.com",
  phone: "555-0198",
  company: "Northwind Labs",
  relationship: "Colleague"
}
```

This object is the contract between form code and render code. Larger apps often formalize this with TypeScript interfaces, schemas, or API DTOs.

## Controlled Form, Vanilla Style

The project reads values from inputs when the form submits:

```js
const contact = {
  id: idInput.value || crypto.randomUUID(),
  name: nameInput.value.trim(),
  email: emailInput.value.trim(),
  phone: phoneInput.value.trim(),
  company: companyInput.value.trim(),
  relationship: relationshipInput.value
};
```

Notice the normalization: `.trim()` removes accidental whitespace before storing. That is a small production habit with real impact.

## Required Validation

```js
if (!contact.name || !contact.email || !contact.phone) {
  setMessage("Name, email, and phone are required.");
  return;
}
```

Frontend validation improves UX, but it is not security. In a real full-stack app, the server must repeat validation because clients can be bypassed.

## Search Strategy

```js
const searchable = `${contact.name} ${contact.email} ${contact.phone} ${contact.company} ${contact.relationship}`.toLowerCase();
return searchable.includes(searchTerm);
```

This is a simple local search index. Production systems may use SQL `ILIKE`, full-text search, Elasticsearch, or a search API, but the product requirement starts the same: define what fields are searchable.

## Edit Flow

```js
editingId = id;
idInput.value = contact.id;
nameInput.value = contact.name;
saveButton.textContent = "Update contact";
clearButton.hidden = false;
```

Editing is a mode. The app stores `editingId` so submit knows whether to create or update. In larger codebases, mode bugs are common, so reset mode carefully after save/delete/cancel.

## Corporate SWE Habits

- Keep validation close to the mutation.
- Name state by purpose: `editingId`, `searchTerm`, `contacts`.
- Avoid hidden coupling. If a selector changes in HTML, update JS references.
- Prefer one render path for all states instead of special-casing DOM mutations.

## Extension Practice

Add tags to contacts. Update the form, object shape, search text, card render, and sample data. That exercise mirrors a common ticket: "Add field X across the stack."
