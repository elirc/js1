const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./browser.cjs");
function app() {
  return load("state,editPoll,handleSubmit,vote,deletePoll");
}
test("removing the first option preserves the remaining option ids and votes", () => {
  const d = app(),
    w = d.window,
    a = w.lesson,
    p = a.state.polls[0],
    ids = p.options
      .map((x) => x.id)
      .slice(1)
      .join(",");
  a.editPoll(p.id);
  w.document.querySelector('[aria-label="Remove option 1"]').click();
  a.handleSubmit({ preventDefault() {} });
  assert.equal(a.state.polls[0].options.map((x) => x.id).join(","), ids);
  assert.equal(a.state.polls[0].options.map((x) => x.votes).join(","), "7,2");
  assert.equal(
    JSON.parse(w.localStorage.getItem("js1-poll-studio"))[0].options[0].votes,
    7,
  );
  d.window.close();
});
test("blank or duplicate options are rejected without changing the saved poll", () => {
  const d = app(),
    a = d.window.lesson,
    p = a.state.polls[0];
  a.editPoll(p.id);
  const before = JSON.stringify(a.state.polls);
  a.state.draftOptions[0].text = " API ";
  a.state.draftOptions[1].text = "api";
  a.handleSubmit({ preventDefault() {} });
  assert.match(
    d.window.document.querySelector("#form-message").textContent,
    /different text/,
  );
  assert.equal(JSON.stringify(a.state.polls), before);
  a.state.draftOptions[1].text = "";
  a.handleSubmit({ preventDefault() {} });
  assert.match(
    d.window.document.querySelector("#form-message").textContent,
    /Fill every/,
  );
  d.window.close();
});
test("failed writes preserve vote totals, the poll and the edit draft", () => {
  const d = app(),
    w = d.window,
    a = w.lesson,
    p = a.state.polls[0];
  a.editPoll(p.id);
  w.document.querySelector("#poll-question").value = "Retain this draft";
  const before = JSON.stringify(a.state.polls);
  w.Storage.prototype.setItem = () => {
    throw new Error("quota");
  };
  a.vote(p.id, p.options[0].id);
  assert.equal(JSON.stringify(a.state.polls), before);
  a.handleSubmit({ preventDefault() {} });
  assert.equal(JSON.stringify(a.state.polls), before);
  assert.equal(
    w.document.querySelector("#poll-question").value,
    "Retain this draft",
  );
  a.deletePoll(p.id);
  assert.equal(JSON.stringify(a.state.polls), before);
  d.window.close();
});
