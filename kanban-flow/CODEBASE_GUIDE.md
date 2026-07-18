# Kanban Flow Codebase Guide

This project teaches drag-and-drop plus CRUD. It is a useful bridge from basic forms to richer interactions found in planning tools and internal workflow apps.

## Code Map

- `index.html`: board columns, form, card containers.
- `styles.css`: column layout, drag states, card styling.
- `app.js`: card CRUD, drag events, ordering, persistence.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  title: "Draft API contract",
  status: "todo",
  order: 1,
  notes: "Define endpoints before implementation."
}
```

`status` controls which column contains the card. `order` controls position inside that column.

## Drag-and-Drop Contract

```js
card.draggable = true;
card.addEventListener("dragstart", () => {
  state.draggingId = cardItem.id;
});
```

Browser drag-and-drop relies on events and temporary state. Production apps often use a library, but the underlying concept is the same: identify the dragged item, identify the drop target, then update data.

## Recomputing Order

After a drop, the app should persist a clean order sequence. This prevents awkward bugs where two cards share the same order value.

```js
columnCards.forEach((card, index) => {
  card.order = index + 1;
});
```

Sequential order fields are common in boards, menus, playlists, and ranked lists.

## Rendering From Sorted Data

```js
cards
  .filter((card) => card.status === column)
  .sort((a, b) => a.order - b.order);
```

Never assume storage order is display order. Make ordering explicit.

## Extension Practice

- Add assignees.
- Add a WIP limit per column.
- Add keyboard move buttons for accessibility.
- Add a "blocked" flag.
- Extract drag handlers into a dedicated section or module.

In larger codebases, drag-and-drop is a hotspot for edge cases. Keep the data update simple and test weird moves.
