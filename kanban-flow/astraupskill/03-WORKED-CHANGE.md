# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Dragging changed a live card before saving, renumbered only the destination, and made self-drops surprising. Movement required drag events.

**After:** Moves validate targets, ignore self-drops, calculate a candidate and renumber every column before saving. Failed moves preserve state. Column selects and move-up/down buttons support keyboard use and restore focus.

## Predict this example

Move A from todo [A,B] before C in doing. B becomes order 0; A/C become orders 0/1. A self-drop does nothing. Reject setItem and the previous card array remains identical.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 86. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function moveCard(columnId, beforeId, cardId = state.draggingId) {
  const current = state.cards.find(card => card.id === cardId);
  if (!current || !COLUMNS.some(column => column.id === columnId)) return false;
  if (beforeId === cardId) return true;
  if (beforeId && !state.cards.some(card => card.id === beforeId && card.column === columnId)) return false;
  const candidate = state.cards.map(card => ({ ...card }));
  const moved = candidate.find(card => card.id === cardId);
  moved.column = columnId;
  for (const column of COLUMNS) {
    const ordered = candidate.filter(card => card.column === column.id && card.id !== cardId)
      .sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
    if (column.id === columnId) ordered.splice(beforeId ? ordered.findIndex(card => card.id === beforeId) : ordered.length, 0, moved);
    ordered.forEach((card,index) => { card.order = index; });
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); }
  catch { showMessage("Could not save the move. The board is unchanged."); return false; }
  state.cards = candidate; render(); showMessage("Card moved."); return true;
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A move changes both membership and sibling order. Moving A out of [A,B] should leave B at order 0. Inserting A before C elsewhere should yield A=0 and C=1. Cloning first makes the intended result reviewable without mutating the current board.

A re-render replaces DOM elements, so focus can disappear even when a keyboard button works. Restoring focus to the moved card lets the user continue without returning to the top. The select expresses destination; up/down expresses order. Both paths call the same move function so keyboard and drag behavior cannot drift apart. Other legacy CRUD paths are outside the failed-move guarantee.

## Three variations to work through

- **Normal variation — move between columns.** Move A from `todo` to `doing` before C: predict B becomes order 0 in `todo`, A order 0 and C order 1 in `doing` (first test).

- **Invalid variation — a bad target.** Move to a column that does not exist, or before a card in another column: predict `false` and no write (second test). Drop A onto its own position: predict `Card is already there.` and no write (fifth test).

- **Boundary variation — two tabs.** Follow the fourth test by hand with two browser tabs: move in tab 1, then move in tab 2 without reloading; reload both and see tab 1's move gone.

## Executable examples

These are the actual regression tests in [test/movement.test.cjs](../test/movement.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./browser.cjs");
function app() {
  return load("state,moveCard,render");
}
test("moving between columns renumbers both columns and survives persisted reconstruction", () => {
  const d = app(),
    a = d.window.lesson;
  a.state.cards = [
    { id: "a", title: "A", column: "todo", order: 0 },
    { id: "b", title: "B", column: "todo", order: 1 },
    { id: "c", title: "C", column: "doing", order: 0 },
  ];
  assert.equal(a.moveCard("doing", "c", "a"), true);
  assert.equal(a.state.cards.find((x) => x.id === "b").order, 0);
  assert.equal(a.state.cards.find((x) => x.id === "c").order, 1);
  const saved = JSON.parse(d.window.localStorage.getItem("js1-kanban-flow"));
  assert.equal(saved.find((x) => x.id === "a").column, "doing");
  assert.equal(saved.find((x) => x.id === "a").order, 0);
  d.window.close();
});
test("self drops, invalid targets and storage failures cannot corrupt order", () => {
  const d = app(),
    w = d.window,
    a = w.lesson,
    id = a.state.cards[0].id;
  const before = JSON.stringify(a.state.cards);
  assert.equal(a.moveCard("todo", id, id), true);
  assert.equal(JSON.stringify(a.state.cards), before);
  assert.equal(a.moveCard("missing", null, id), false);
  assert.equal(a.moveCard("doing", "unknown", id), false);
  w.Storage.prototype.setItem = () => {
    throw new Error("quota");
  };
  assert.equal(a.moveCard("doing", null, id), false);
  assert.equal(JSON.stringify(a.state.cards), before);
  d.window.close();
});
test("keyboard controls move and reorder a card without drag events", () => {
  const d = app(),
    w = d.window,
    a = w.lesson;
  a.state.cards = [
    { id: "a", title: "A", column: "todo", order: 0 },
    { id: "b", title: "B", column: "todo", order: 1 },
  ];
  a.render();
  const card = w.document.querySelector('[data-id="a"]');
  [...card.querySelectorAll("button")]
    .find((x) => x.textContent === "Move down")
    .click();
  assert.equal(a.state.cards.find((x) => x.id === "a").order, 1);
  const select = w.document.querySelector('[data-id="a"] select');
  select.value = "done";
  select.dispatchEvent(new w.Event("change"));
  assert.equal(a.state.cards.find((x) => x.id === "a").column, "done");
  assert.equal(w.document.activeElement.className, "move-column");
  d.window.close();
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
