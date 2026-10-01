# Trace lab: immutable movement, ordering invariants and keyboard access

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from something you have actually run:

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

Run it, watch what it prints, then follow the boundaries below with that exact scenario in mind.

## Prepare a prediction

Open [app.js](../app.js) and [test/movement.test.cjs](../test/movement.test.cjs) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Move A from todo [A,B] before C in doing. B becomes order 0; A/C become orders 0/1. A self-drop does nothing. Reject setItem and the previous card array remains identical.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the drop or keyboard control decides what to move

`app.js:144` (drop) and `moveByKeyboard` (`app.js:105`) call `moveCard(columnId, beforeId, cardId)`; the `.move-column` select (`app.js:188`) is the keyboard path.

### Boundary 2 — `moveCard` builds a candidate

`app.js:86`: validate the target column and `beforeId`, copy every card, set the moved card's column, re-sort and renumber every column from 0.

### Boundary 3 — no-op detection

if the candidate equals the current board, report `Card is already there.` and return without writing (fix pass).

### Boundary 4 — the storage boundary accepts or throws

`localStorage.setItem` inside `try`; on failure show the message and return `false` with `state.cards` untouched.

### Boundary 5 — publish only after success

`state.cards = candidate; render(); showMessage("Card moved.")` runs only after the write succeeded: commit before publish.

### Boundary 6 — the read path reconstructs state

`loadCards` (`app.js:30`) parses `localStorage` on start; the first test reloads to prove the persisted order, and the fourth shows what a stale tab does to it.

## Expected observations

| Action or input | Expected result |
|---|---|
| A,B in todo; C in doing; move A before C | todo B=0; doing A=0,C=1 |
| Self-drop A before A | No-op |
| Unknown column | Rejected before save |
| Write throws | Previous card state preserved |
| Keyboard movement | Same move boundary, focus restored |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

A move changes both membership and sibling order. Moving A out of [A,B] should leave B at order 0. Inserting A before C elsewhere should yield A=0 and C=1. Cloning first makes the intended result reviewable without mutating the current board.

A re-render replaces DOM elements, so focus can disappear even when a keyboard button works. Restoring focus to the moved card lets the user continue without returning to the top. The select expresses destination; up/down expresses order. Both paths call the same move function so keyboard and drag behavior cannot drift apart. Other legacy CRUD paths are outside the failed-move guarantee.

Pause near `moveCard` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- moving between columns renumbers both columns and survives persisted reconstruction
- self drops, invalid targets and storage failures cannot corrupt order
- keyboard controls move and reorder a card without drag events

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
