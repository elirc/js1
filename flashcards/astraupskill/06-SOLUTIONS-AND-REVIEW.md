# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");

const KEY = "js1-flashcards";
const cards = [
  { id: "a", deck: "JS", front: "Question A", back: "Answer A", known: false },
  { id: "b", deck: "JS", front: "Question B", back: "Answer B", known: true },
  { id: "c", deck: "CSS", front: "Question C", back: "Answer C", known: false },
];
test("unlearned session snapshots matching ids, requires reveal, and completes once", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(cards) });
  try {
    app.document.querySelector("#deck-filter").value = "JS";
    app.event("#deck-filter", "change");
    app.document.querySelector("#unlearned-only").checked = true;
    app.event("#unlearned-only", "change");
    app.event("#study-tab", "click");
    assert.equal(app.evaluate("state.studyOrder.join()"), "a");
    assert.equal(app.document.querySelector("#known-button").disabled, true);
    app.event("#flip-button", "click");
    app.event("#known-button", "click");
    assert.match(
      app.document.querySelector("#flashcard-text").textContent,
      /Session complete/,
    );
    assert.equal(app.document.querySelector("#known-button").disabled, true);
    app.evaluate("grade(false)");
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY))[0].known, true);
    app.evaluate("startStudy(false)");
    assert.equal(app.evaluate("state.studyOrder.length"), 0);
  } finally {
    app.close();
  }
});
test("changing decks restarts the active session; failed grade preserves position and persisted state", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(cards) });
  try {
    app.event("#study-tab", "click");
    app.document.querySelector("#deck-filter").value = "CSS";
    app.event("#deck-filter", "change");
    assert.equal(
      app.document.querySelector("#flashcard-text").textContent,
      "Question C",
    );
    app.event("#flip-button", "click");
    app.evaluate(
      'Storage.prototype.setItem = () => { throw new Error("quota"); }',
    );
    app.event("#known-button", "click");
    assert.equal(app.evaluate("state.studyIndex"), 0);
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY))[2].known, false);
    assert.match(
      app.document.querySelector("#study-summary").textContent,
      /Could not save/,
    );
  } finally {
    app.close();
  }
});
test("shuffle and restart mid-session keeps an already-graded card's known flag", async () => {
  const app = await openApp({ [KEY]: JSON.stringify(cards) });
  try {
    app.document.querySelector("#deck-filter").value = "JS";
    app.event("#deck-filter", "change");
    app.event("#study-tab", "click");
    assert.equal(app.evaluate("state.studyOrder.join()"), "a,b");
    app.event("#flip-button", "click");
    app.event("#known-button", "click");
    assert.equal(app.evaluate("state.studyIndex"), 1);
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY))[0].known, true);

    // Restart mid-session. The snapshot is rebuilt, but the graded flag is
    // persisted state and must survive: startStudy only resets the cursor and
    // the revealed flag, it never writes cards.
    app.evaluate("startStudy(true)");
    assert.equal(app.evaluate("state.studyIndex"), 0);
    assert.equal(app.evaluate("state.flipped"), false);
    assert.equal(app.evaluate("state.studyOrder.length"), 2);
    const saved = JSON.parse(app.w.localStorage.getItem(KEY));
    assert.equal(saved.find((card) => card.id === "a").known, true);
    assert.equal(saved.find((card) => card.id === "b").known, true);

    // With the unlearned-only filter on, the restarted session is empty
    // because both JS cards are now known - eligibility is recomputed at
    // startStudy, while the snapshot inside a session never is.
    app.document.querySelector("#unlearned-only").checked = true;
    app.event("#unlearned-only", "change");
    assert.equal(app.evaluate("state.studyOrder.length"), 0);
    assert.match(
      app.document.querySelector("#flashcard-text").textContent,
      /No matching cards/,
    );
  } finally {
    app.close();
  }
});
```

## Existing implementation

Study can select unlearned cards only, changing decks restarts the session, and the final grade produces an explicit completion state. Grading requires revealing the answer. Failed storage leaves the card and cursor unchanged.

The key model is: Cards have stable ids, deck, front, back and known. A session holds a snapshot of eligible ids, a cursor and a revealed-answer flag. Saved cards and temporary session state serve different purposes.

The worked fixture should behave as follows: JS contains a unknown and b known; CSS contains c unknown. Select JS and unlearned-only: the session contains just a. Reveal and mark it known: progress becomes Completed 1 of 1 and grading is disabled. Restarting now finds no eligible cards. A rejected write instead keeps a at index zero.

## Extension solutions

### Exercise 1

**Prompt:** Add a restart button preserving original order.

**Approach:** Call startStudy(false), retain the deck/filter and test completion followed by restart.

**Review:** You are done when restarting after completion re-runs the *same* ids in the *same* order. The naive implementation calls `startStudy(true)`, or rebuilds the order from `visibleCards()` — both are wrong here, because a card graded `known` during the session would vanish from the rebuilt order while `state.unlearnedOnly` is on. Keep `state.studyOrder` and reset only `state.studyIndex` and `state.flipped`. The invariant that must survive: a session's order is a snapshot taken once, never a live filter (`app.js:222-230`). Show the failing case: study JS unlearned-only with two cards, grade both, restart, and assert the order still has length 2.

### Exercise 2

**Prompt:** Track a session-specific correct count.

**Approach:** Store this session's grades keyed by id; do not infer them from flags saved in earlier sessions.

**Review:** You are done when the session counter reports grades made *in this session*, and a card already `known` before the session started does not inflate it. The naive implementation counts `state.studyOrder.filter(id => cards.find(c => c.id === id).known)` — which is exactly what `renderStudy` does at `app.js:284-288` for the persistent summary, and is the wrong number for a session counter. Add a separate `Map` or object keyed by id, written in `grade` only after the persistence boundary succeeds (`app.js:254`), so a rejected write does not bump the session count either. Show both cases: a card that was already known, and a rejected write.

### Exercise 3

**Prompt:** Test a failed grade followed by a successful retry.

**Approach:** Reject setItem once, restore the writer, retry and verify one cursor increment and one saved result.

**Review:** You are done when the *second* attempt succeeds and the state moved exactly once. The naive implementation restores `Storage.prototype.setItem` and asserts only that the final `known` is `true` — that passes even if the first, failed attempt had already advanced the cursor and the retry graded the *next* card. Assert the whole tuple: `state.studyIndex === 1` (not 2), `state.flipped === false`, the persisted array has exactly one card flipped to `known`, and `#study-summary` no longer shows "Could not save". The invariant is the one `grade` promises at `app.js:247-253`: a failed write leaves the cursor where it was.

### Exercise 4

**Prompt:** Design spaced repetition and saved-data migration.

**Approach:** Choose a scheduling rule, store due dates separately from order and migrate old known-only records deliberately.

**Review:** This is a design exercise, so the deliverable is a written note, not a green test. You are done when the note answers three questions the current schema cannot: where does a due date live (a new field on the card, or a separate `reviews` array keyed by id?), what happens to the ~N existing records that have only `known: true|false` and no schedule, and what a session's snapshot means when eligibility now depends on the clock. Name the migration policy explicitly — "on load, a card with `known: true` and no `dueAt` gets `dueAt = today + 1 day`" is a decision; "handle old data" is not. The invariant to preserve: `loadCards` (`app.js:81-84`) must never throw on data written by the current build, and must never silently drop a field it does not recognize.

## Answer key for the chapter 3 prediction table

Fill the table in [03-WORKED-CHANGE.md](03-WORKED-CHANGE.md) before reading this. The fixture is
the one in [test/study.test.cjs](../test/study.test.cjs): card `a` (deck JS, `known: false`),
card `b` (deck JS, `known: true`), card `c` (deck CSS, `known: false`), with the deck filter on
`JS` and "unlearned only" ticked.

| # | Action | `studyOrder` | `studyIndex` | `flipped` | stored `known` for `a` | `#flashcard-text` | `#known-button.disabled` |
|---|---|---|---|---|---|---|---|
| 0 | open Study | `['a']` | 0 | `false` | `false` | `Question A` | `true` |
| 1 | click `#flip-button` | `['a']` | 0 | `true` | `false` | `Answer A` | `false` |
| 2 | click `#known-button` | `['a']` | 1 | `false` | `true` | `Session complete. Start again with Shuffle & restart.` | `true` |
| 3 | call `grade(false)` again | `['a']` | 1 | `false` | `true` (unchanged) | `Session complete...` | `true` |
| 4 | `startStudy(false)` | `[]` | 0 | `false` | `true` | `No matching cards. ...` | `true` |

Row 3 is the one worth arguing about: the second `grade` is a no-op not because the button is
disabled (a test can call `grade` directly, and the delivered test does) but because
`currentStudyCard()` returns `undefined` at `app.js:232-235` and the guard at `app.js:245`
returns. Row 4 shows the difference between "finished" and "empty": both have no current card,
but `total` is 0 in row 4 and 1 in row 2, which is the branch at `app.js:269-273`.

Now the failure variant. Replace row 2 with "stub `Storage.prototype.setItem` to throw, then
click `#known-button`":

| # | Action | `studyOrder` | `studyIndex` | `flipped` | stored `known` for `a` | `#study-summary` |
|---|---|---|---|---|---|---|
| 2' | grade with a throwing `setItem` | `['a']` | **0** | **`true`** | **`false`** | `Could not save your grade. Try again; this card has not advanced.` |

Three of those four cells are the whole point of the change: the cursor did not move, the card
is still revealed so the learner can retry without re-flipping, and the persisted byte string
is untouched.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/study.test.cjs](../test/study.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Grading the last card never advanced beyond it. Changing decks during study retained the old order, and there was no unlearned-only study option. I changed the implementation so that: Study can select unlearned cards only, changing decks restarts the session, and the final grade produces an explicit completion state. Grading requires revealing the answer. Failed storage leaves the card and cursor unchanged. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
