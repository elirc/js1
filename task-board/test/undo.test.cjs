const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");
const KEY = "js1-task-board";
const tasks = ["a", "b", "c"].map((id) => ({
  id,
  title: id,
  due: "2026-10-01",
  priority: "Low",
  status: "Backlog",
  notes: "",
}));
test("legacy data upgrades; undo after reload restores identity and position once", async () => {
  let app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  const saved = app.snapshot();
  app.close();
  app = await openApp(saved);
  assert.equal(app.document.querySelector("#undo-delete").disabled, false);
  app.event("#undo-delete", "click");
  let result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["a", "b", "c"],
  );
  assert.equal(result.deleted, null);
  app.evaluate("undoDelete()");
  assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).tasks.length, 3);
  app.close();
});
test("undo preserves intervening edits and uses only the latest deletion", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate(
    "deleteTask('a'); state.tasks[0].title = 'Edited B'; saveTasks(); deleteTask('c'); undoDelete()",
  );
  const result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["b", "c"],
  );
  assert.equal(result.tasks[0].title, "Edited B");
  app.close();
});
test("failed storage does not delete a task or consume recovery data", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); }; deleteTask('b')",
  );
  assert.equal(app.evaluate("state.tasks.length"), 3);
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /Could not save/,
  );
  app.close();
});
test("creating a task persists before publishing and keeps the undo record", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  app.evaluate(
    "document.querySelector('#task-title').value = 'New task';" +
      "document.querySelector('#task-due').value = '2026-11-01';",
  );
  app.event("#task-form", "submit");
  const result = JSON.parse(app.w.localStorage.getItem(KEY));
  assert.deepEqual(
    result.tasks.map((task) => task.title),
    ["New task", "a", "c"],
  );
  assert.equal(result.deleted.task.id, "b");
  assert.equal(app.evaluate("state.tasks.length"), 3);
  app.close();
});
test("failed storage on create adds no task and does not consume recovery data", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(tasks) });
  app.evaluate("deleteTask('b')");
  app.evaluate(
    "Storage.prototype.setItem = () => { throw new Error('quota'); };" +
      "document.querySelector('#task-title').value = 'New task';" +
      "document.querySelector('#task-due').value = '2026-11-01';",
  );
  app.event("#task-form", "submit");
  assert.equal(app.evaluate("state.tasks.length"), 2);
  assert.equal(app.evaluate("state.deleted.task.id"), "b");
  assert.match(
    app.document.querySelector("#form-message").textContent,
    /Could not save/,
  );
  app.close();
});
