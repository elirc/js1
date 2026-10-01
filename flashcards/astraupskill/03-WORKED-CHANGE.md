# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Grading the last card never advanced beyond it. Changing decks during study retained the old order, and there was no unlearned-only study option.

**After:** Study can select unlearned cards only, changing decks restarts the session, and the final grade produces an explicit completion state. Grading requires revealing the answer. Failed storage leaves the card and cursor unchanged.

## Predict this example

JS contains a unknown and b known; CSS contains c unknown. Select JS and unlearned-only: the session contains just a. Reveal and mark it known: progress becomes Completed 1 of 1 and grading is disabled. Restarting now finds no eligible cards. A rejected write instead keeps a at index zero.

Before running anything, fill in this table. Copy it into your notes and write every cell; do
not run the test first. The answer key is in
[06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md) under "Answer key for the chapter 3
prediction table" - read it only after your table is complete.

| # | Action | `state.studyOrder` | `state.studyIndex` | `state.flipped` | stored `known` for card `a` | `#flashcard-text` | `#known-button.disabled` |
|---|---|---|---|---|---|---|---|
| 0 | open the Study tab | | | | | | |
| 1 | click `#flip-button` | | | | | | |
| 2 | click `#known-button` | | | | | | |
| 3 | call `grade(false)` again | | | | | | |
| 4 | call `startStudy(false)` | | | | | | |

Then fill the failure row separately: replace step 2 with "stub `Storage.prototype.setItem` to
throw, then click `#known-button`" and predict `studyOrder`, `studyIndex`, `flipped`, the stored
`known` for `a`, and the text of `#study-summary`.

Then run the focused tests and reproduce the matching UI action. Do not settle for seeing a
success message: read `localStorage.getItem('js1-flashcards')` and inspect the authoritative
stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 243. It is a teaching snapshot; the
linked source is authoritative if you later edit the project. Read surrounding code for callers
and setup.

**Every line of this function changed.** Here is what it was before, from
`AstraOrganized2/astrafinalplan/implementation/batch02/backups/11/app.js:235-245`:

```javascript
function grade(known) {
  const card = currentStudyCard();
  if (!card) return;                                   // no reveal requirement
  card.known = known;                                  // mutates the live record FIRST
  saveCards();                                         // ...then tries to save, ignoring failure
  if (state.studyIndex < state.studyOrder.length - 1) { // cursor clamped to the last card
    state.studyIndex += 1;
    state.flipped = false;
  }
  renderStudy();
}
```

Four defects in ten lines: the guard does not require a reveal; the record is mutated before it
is persisted, so a quota error leaves memory and storage disagreeing; `saveCards()` swallows the
failure (`app.js:86-88` has no try/catch of its own in the old build either); and the cursor can
never reach `studyOrder.length`, so the last card is a dead end. Read the delivered version
below and point at the line that fixes each one.

```javascript
function grade(known) {
  const card = currentStudyCard();
  if (!card || !state.flipped) return;
  const next = state.cards.map((item) => item.id === card.id ? { ...item, known } : item);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    state.studyError = "Could not save your grade. Try again; this card has not advanced.";
    renderStudy();
    return;
  }
  state.cards = next;
  state.studyError = "";
  state.studyIndex += 1;
  state.flipped = false;
  renderStudy();
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A session should not continuously recompute its order from changing known flags. If grading immediately removed a card from a live filtered array, incrementing the cursor could skip the next card. Snapshot ids at session start, then look up each card by identity. The cursor may equal the length: that represents completion, not a value to hide by clamping it to the last index. Reveal-before-grade is another state transition. The disabled button communicates the rule, while the handler guard protects repeated or direct invocation. Write the changed known flag before advancing. Only knowledge flags persist; the current session does not resume after reload. A missed card is revisited in a new session, not repeatedly inserted into this one. Those are product choices to explain before adding spaced repetition.

## Three variations to work through

Each one is a concrete edit to the fixture in [test/study.test.cjs](../test/study.test.cjs).
Predict the result, then make the edit and run `node --test test/study.test.cjs`.

**Variation 1 (normal) - flip card `b` to `known: false`.**
Change the fixture's second card from `known: true` to `known: false` and leave everything else
alone. Expected result: `state.studyOrder` becomes `['a','b']` instead of `['a']`, so the first
assertion `app.evaluate('state.studyOrder.join()')` must be changed from `'a'` to `'a,b'`.
Grading `a` now moves `studyIndex` to 1 and shows `Question B` rather than "Session complete",
so the `/Session complete/` assertion fails until you grade twice. Nothing about persistence
changes. The point: eligibility is computed once, at `app.js:223`, from the flags as they were
when the session started.

**Variation 2 (invalid) - grade before flipping.**
Delete `app.event('#flip-button','click');` from the first test, leaving the click on
`#known-button`. Expected result: exactly **zero** writes. `state.flipped` is `false`, so the
guard at `app.js:245` returns before the `map` at `:246`, which means no candidate array is even
built. Assert the whole tuple, not the message:
`JSON.parse(app.w.localStorage.getItem(KEY))[0].known === false`, `state.studyIndex === 0`, and
`app.document.querySelector('#flashcard-text').textContent === 'Question A'` (still the front).
Note that there is no error text at all here - the UI's only feedback is the disabled button,
which is the weakness of guarding by early return. Contrast that with variation 3.

**Variation 3 (boundary) - fail the write, then let it succeed.**
Replace the blanket `Storage.prototype.setItem = () => { throw ... }` in the second test with a
counter that throws only on its first call:

```javascript
app.evaluate(`
  let calls = 0;
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    calls += 1;
    if (calls === 1) throw new Error("quota");
    return real.call(this, k, v);
  };
`);
```

Expected result after the first click on `#known-button`: `state.studyIndex` is 0, `flipped` is
still `true`, `#study-summary` matches `/Could not save/`, and the persisted `known` for card
`c` is `false`. Click it a second time without flipping again - this is why the failure path
deliberately leaves `flipped` alone - and expect `studyIndex` to become 1, the summary to stop
showing the error (`app.js:255` clears `state.studyError`), and the persisted `known` to be
`true`. The boundary differs from the happy path in exactly one way: the retry must move the
cursor **once**, not twice. A naive implementation that advanced the cursor before writing would
show `studyIndex === 2` here and skip a card.

## Executable examples

These are the actual regression tests in [test/study.test.cjs](../test/study.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
