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
