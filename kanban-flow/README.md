# Kanban Flow CRUD

A vanilla JavaScript kanban board for practicing the **native HTML5
drag-and-drop API** — moving and reordering records without a library.

## What it practices

- `draggable`, `dragstart`, `dragover`, `dragleave`, `drop`, and `dragend`
- Calling `event.preventDefault()` on `dragover` so a drop is allowed
- Finding the drop target with `event.target.closest(".card")`
- Recomputing an `order` field per column and persisting it
- CRUD on cards with localStorage persistence

## How dropping works

Each card stores `column` and `order`. On drop, `moveCard` figures out which
card you dropped *before* (or appends to the end of the column), reinserts the
dragged card, and renumbers the column so the order survives a reload.

## Things to try

1. Add a drop indicator line that shows exactly where the card will land.
2. Add a "WIP limit" that blocks dropping into a column past N cards.
3. Make columns configurable instead of hard-coded.

Open `index.html` in a browser to run it.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): immutable movement, ordering invariants and keyboard access, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
