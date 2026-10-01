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

test("a stale snapshot committing over a newer one wins by last write: the persisted board loses the earlier move", () => {
  const d = app(),
    a = d.window.lesson;
  a.state.cards = [
    { id: "a", title: "A", column: "todo", order: 0 },
    { id: "b", title: "B", column: "todo", order: 1 },
  ];
  d.window.localStorage.setItem("js1-kanban-flow", JSON.stringify(a.state.cards));
  // Tab 1 and tab 2 both start from this board.
  const tab2Snapshot = JSON.parse(JSON.stringify(a.state.cards));
  // Tab 1 moves A to doing and persists.
  assert.equal(a.moveCard("doing", null, "a"), true);
  assert.equal(JSON.parse(d.window.localStorage.getItem("js1-kanban-flow")).find((x) => x.id === "a").column, "doing");
  // Tab 2 still holds the old board in memory and moves B: it persists its whole (stale) board.
  a.state.cards = tab2Snapshot;
  assert.equal(a.moveCard("done", null, "b"), true);
  const persisted = JSON.parse(d.window.localStorage.getItem("js1-kanban-flow"));
  assert.equal(persisted.find((x) => x.id === "b").column, "done");
  assert.equal(persisted.find((x) => x.id === "a").column, "todo", "tab 1's move was overwritten: last writer wins");
  d.window.close();
});
test("dropping a card onto its own position writes nothing", () => {
  const d = app(),
    a = d.window.lesson;
  a.state.cards = [{ id: "a", title: "A", column: "todo", order: 0 }];
  d.window.localStorage.setItem("js1-kanban-flow", "sentinel");
  assert.equal(a.moveCard("todo", null, "a"), true);
  assert.equal(d.window.localStorage.getItem("js1-kanban-flow"), "sentinel");
  d.window.close();
});
