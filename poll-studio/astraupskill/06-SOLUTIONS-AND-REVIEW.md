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

## Existing implementation

Draft options carry stable ids. Surviving options retain their votes; new options start at zero. Blank or duplicate labels are rejected. Save, vote, reset and delete publish state only after storage succeeds.

The key model is: A poll has id, question and options. An option has its own id, text and votes. Drafts contain id/text; they become the saved poll only at commit. Data lives under js1-poll-studio in localStorage.

The worked fixture should behave as follows: Remove Mobile app from the starter poll. Public API retains 7 votes and Dark mode retains 2, for 9 total. Duplicate labels API/api are rejected. A failed write preserves both the old poll and the current draft.

## Extension solutions

### Exercise 1

**Prompt:** Reorder option rows without detaching their votes.

**Approach:** Move complete draft objects, including ids; assert votes still match ids after submit.

**Review:** reorder must preserve id/vote pairs (assert the permutation), must go through `commitPolls`, and must not renumber ids.

### Exercise 2

**Prompt:** Distinguish correcting a label from replacing its meaning.

**Approach:** Correction keeps the id. Explicit replacement should allocate a new id and start at zero, with clear wording.

**Review:** percentages must be derived at render time; the test asserts the sum and that the stored poll is unchanged.

### Exercise 3

**Prompt:** Add a confirmation before resetting votes.

**Approach:** Build the zero-vote candidate only after confirmation. Cancel must not change storage or state.

**Review:** the failing `setItem` must be injected around a vote, and the test must assert vote totals, the poll and the draft in one go.

### Exercise 4

**Prompt:** Validate a full imported poll graph.

**Approach:** Check unique ids, bounded strings, 2-6 options and nonnegative safe-integer votes. Reject malformed imports as a whole.

**Review:** the fetch-backed commit must keep the same publish-after-commit order and the same failure behavior; the test must stub `fetch` to reject and assert nothing was published.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/polls.test.cjs](../test/polls.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Vote preservation depended on option count and position. Removing a row could reset other votes, and a failed write could leave memory ahead of storage. I changed the implementation so that: Draft options carry stable ids. Surviving options retain their votes; new options start at zero. Blank or duplicate labels are rejected. Save, vote, reset and delete publish state only after storage succeeds. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
