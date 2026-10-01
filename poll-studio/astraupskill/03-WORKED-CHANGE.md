# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Vote preservation depended on option count and position. Removing a row could reset other votes, and a failed write could leave memory ahead of storage.

**After:** Draft options carry stable ids. Surviving options retain their votes; new options start at zero. Blank or duplicate labels are rejected. Save, vote, reset and delete publish state only after storage succeeds.

## Predict this example

Remove Mobile app from the starter poll. Public API retains 7 votes and Dark mode retains 2, for 9 total. Duplicate labels API/api are rejected. A failed write preserves both the old poll and the current draft.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 96. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function handleSubmit(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  const draft = state.draftOptions.map(option => ({ ...option, text: option.text.trim() }));
  if (!question || question.length > 160) return showMessage("Add a question of at most 160 characters.");
  if (draft.length < MIN_OPTIONS || draft.length > MAX_OPTIONS || draft.some(x => !x.text || x.text.length > 80))
    return showMessage("Fill every option, or remove its row. Use 2 to 6 options of at most 80 characters.");
  if (new Set(draft.map(x => x.text.toLowerCase())).size !== draft.length)
    return showMessage("Each option must have different text (ignoring letter case).");
  const existing = state.polls.find(poll => poll.id === state.editingId);
  if (state.editingId && !existing) return showMessage("This poll no longer exists.");
  const options = draft.map(option => ({ ...option, votes: existing?.options.find(x => x.id === option.id)?.votes ?? 0 }));
  const poll = { id: existing?.id ?? crypto.randomUUID(), question, options };
  const candidate = existing ? state.polls.map(x => x.id === poll.id ? poll : x) : [poll, ...state.polls];
  if (!commitPolls(candidate)) return;
  showMessage(existing ? "Poll updated." : "Poll created."); resetForm(); render();
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

An index describes position, not identity. If A, B and C have 4, 7 and 2 votes, deleting A moves B from index 1 to 0. Matching by position can now attach the wrong votes. Matching by id finds the same option wherever it appears. A new option receives a fresh id, so it cannot inherit removed votes. Renaming an existing option preserves its votes; the app treats that as a label correction, not a new election choice.

Validation precedes candidate construction. Trimming labels is normalization; rejecting equal case-folded labels is validation. A storage quota failure leaves the saved poll and current draft available for retry. The candidate does not become authoritative until setItem succeeds. This is a local poll builder, not a secure voting system.

## Three variations to work through

- **Normal variation — remove the first option.** With three options and votes, remove the first: predict the remaining two keep their ids and votes (first test).

- **Invalid variation — a duplicate option.** Submit options `["A", "a"]`: predict the rejection message and that the saved poll is unchanged (second test). Paste a 170-character question: predict the browser truncates at 160 (maxlength) and, if scripted, `handleSubmit` rejects it.

- **Boundary variation — a failed write.** Make `setItem` throw and vote: predict the totals, the poll and the edit draft unchanged (third test).

## Executable examples

These are the actual regression tests in [test/polls.test.cjs](../test/polls.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
