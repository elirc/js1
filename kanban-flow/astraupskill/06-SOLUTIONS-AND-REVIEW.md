# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

Moves validate targets, ignore self-drops, calculate a candidate and renumber every column before saving. Failed moves preserve state. Column selects and move-up/down buttons support keyboard use and restore focus.

The key model is: Each card has id, title, column and order. Column is todo/doing/done; order is a zero-based position within that column. The browser stores the card array under js1-kanban-flow.

The worked fixture should behave as follows: Move A from todo [A,B] before C in doing. B becomes order 0; A/C become orders 0/1. A self-drop does nothing. Reject setItem and the previous card array remains identical.

## Extension solutions

### Exercise 1

**Prompt:** Disable up/down at column boundaries.

**Approach:** Derive boundary state from cardsIn, while retaining handler guards.

**Review:** the invariant helper must check every column after every move in every test, and must fail if two cards share an `order` in one column.

### Exercise 2

**Prompt:** Add a drag insertion marker.

**Approach:** Show the intended beforeId without changing storage until drop.

**Review:** the date rule must be the same round-trip check the server courses use, the rejection must not write, and the sort must fall back to id.

### Exercise 3

**Prompt:** Enforce a doing-column work-in-progress limit.

**Approach:** Count destination cards excluding the moved id; enforce the rule in moveCard for both input methods.

**Review:** the failure must be injected during add, and the test must assert both the board and the form draft are unchanged.

### Exercise 4

**Prompt:** Replace prompt-based renaming with an inline form.

**Approach:** Use a candidate title update, persist first and retain the form on failure.

**Review:** the `storage` handler must merge by reloading before a move (not by blindly replacing `state`), and the write-up must name the remaining race between reload and write.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/movement.test.cjs](../test/movement.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Dragging changed a live card before saving, renumbered only the destination, and made self-drops surprising. Movement required drag events. I changed the implementation so that: Moves validate targets, ignore self-drops, calculate a candidate and renumber every column before saving. Failed moves preserve state. Column selects and move-up/down buttons support keyboard use and restore focus. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
