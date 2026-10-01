# Trace lab: identity in dynamic arrays and commit-before-publish

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from something you have actually run:

```javascript
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
```

Run it, watch what it prints, then follow the boundaries below with that exact scenario in mind.

## Prepare a prediction

Open [app.js](../app.js) and [test/polls.test.cjs](../test/polls.test.cjs) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

Remove Mobile app from the starter poll. Public API retains 7 votes and Dark mode retains 2, for 9 total. Duplicate labels API/api are rejected. A failed write preserves both the old poll and the current draft.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to commit

`app.js:96` `handleSubmit`: reads the question and option rows, validates length and duplicates, builds a `candidate` polls array with stable option ids, and calls `commitPolls(candidate)`.

### Boundary 2 — the candidate is serialized

`commitPolls` (`app.js:57`): `JSON.stringify(candidate)` then `localStorage.setItem(STORAGE_KEY, ...)` inside `try`; nothing in `state` has changed yet.

### Boundary 3 — the storage boundary accepts or throws

`setItem` can throw (quota, private mode). The `catch` shows a message and returns `false`, so callers return early and `state.polls` still holds the previous value.

### Boundary 4 — publish only after success

each caller (`handleSubmit`, `vote`, `resetVotes`, `deletePoll`) assigns `state.polls = candidate` and calls `render()` only when `commitPolls` returned `true`: commit before publish.

### Boundary 5 — the read path reconstructs state

`loadPolls` (`app.js:50`) parses `localStorage` on start; a reload proves what was actually committed.

### Boundary 6 — the render shows committed state

`render()` (`app.js:150`) draws from `state.polls`; the first test removes an option and checks the remaining ids and votes survived a reconstruction.

## Expected observations

| Action or input | Expected result |
|---|---|
| Remove starter Mobile app | Surviving Public API=7 and Dark mode=2; total 9 |
| Rename surviving option | Same id and votes |
| Add new option | Fresh id and zero votes |
| API and api labels | Rejected duplicate |
| Storage write fails | Saved state and current draft retained |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

An index describes position, not identity. If A, B and C have 4, 7 and 2 votes, deleting A moves B from index 1 to 0. Matching by position can now attach the wrong votes. Matching by id finds the same option wherever it appears. A new option receives a fresh id, so it cannot inherit removed votes. Renaming an existing option preserves its votes; the app treats that as a label correction, not a new election choice.

Validation precedes candidate construction. Trimming labels is normalization; rejecting equal case-folded labels is validation. A storage quota failure leaves the saved poll and current draft available for retry. The candidate does not become authoritative until setItem succeeds. This is a local poll builder, not a secure voting system.

Pause near `handleSubmit` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- removing the first option preserves the remaining option ids and votes
- blank or duplicate options are rejected without changing the saved poll
- failed writes preserve vote totals, the poll and the edit draft

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
