# Flashcards - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. State holds `cards`, a `mode`
> (`manage` | `study`), a `deck` filter, plus a study session (`studyOrder`,
> `studyIndex`, `flipped`). Each card is `{ id, front, back, deck, known }`.
> `setMode()` swaps views; `startStudy()`/`grade()`/`flip()` drive study;
> `renderManage()`/`renderStudy()` render. Persists to `localStorage`.

---

## Story 1: Study only unlearned cards
**As a** user, **I want** to skip cards I already know, **so that** I focus on weak spots.

### Acceptance criteria
- [ ] A "Only unlearned" toggle in study mode limits the session to cards where `known` is false.
- [ ] The progress counter and summary reflect the filtered set.
- [ ] If all cards are known, study shows a "You've learned everything" state.

### Implementation plan
1. **`app.js`** - add `state.onlyUnlearned = false`.
2. **`startStudy(shuffle)`** - build `studyOrder` from `visibleCards().filter(c => !state.onlyUnlearned || !c.known)`.
3. **`index.html`** - add an "Only unlearned" checkbox in the study view; on change set the flag and call `startStudy(false)`.
4. **`renderStudy()`** - when `studyOrder.length === 0` and `onlyUnlearned`, show the "learned everything" message instead of the empty-deck message.

### How to test
Mark some cards "Got it", enable "Only unlearned", confirm only the rest appear; mark all known and confirm the celebratory empty state.

---

## Story 2: Spaced repetition by miss count
**As a** user, **I want** harder cards to come up more often, **so that** I learn efficiently.

### Acceptance criteria
- [ ] "Again" increments a card's `misses`; "Got it" decrements it (min 0).
- [ ] A new study session orders cards by `misses` descending (hardest first) before any shuffle.
- [ ] Each manage-view card shows its miss count.

### Implementation plan
1. **`app.js`** - add `misses: 0` to new cards and `starterCards`.
2. **`grade(known)`** - when `!known` do `card.misses = (card.misses||0)+1`; when `known` do `card.misses = Math.max(0,(card.misses||0)-1)`; then `saveCards()`.
3. **`startStudy(shuffle)`** - after building the id list, sort by the card's `misses` descending; only call `shuffleArray` when `shuffle` is true (so "Shuffle" still overrides ordering).
4. **`renderManage()`** - show `misses` on each card.

### How to test
Mark a card "Again" twice, start a new session, confirm it appears first; "Got it" reduces its misses.

---

## Story 3: Deck management (rename / delete)
**As a** user, **I want** to manage decks, **so that** I can keep them organized.

### Acceptance criteria
- [ ] In manage mode I can rename a deck (updates every card in it) and delete a deck (with confirmation, removing its cards).
- [ ] The deck filter and study selector update accordingly.

### Implementation plan
1. **`index.html`** - next to the deck filter, add small "Rename deck" and "Delete deck" buttons that act on the currently selected `state.deck` (disabled when `deck === "All"`).
2. **`app.js`** - `renameDeck()`: `const next = prompt("Rename deck", state.deck); if(!next?.trim()) return; state.cards = state.cards.map(c => c.deck===state.deck ? {...c, deck:next.trim()} : c); state.deck = next.trim(); saveCards(); render();`.
3. **`app.js`** - `deleteDeck()`: confirm, then `state.cards = state.cards.filter(c => c.deck !== state.deck); state.deck = "All"; saveCards(); render();`.
4. `renderDeckControls()` already rebuilds the dropdowns from the data, so they refresh automatically.

### How to test
Rename "Spanish" to "Espaol", confirm all its cards move and the filter updates; delete a deck and confirm its cards are gone.

---

## Story 4: Keyboard shortcuts in study mode
**As a** user, **I want** keyboard controls, **so that** I can review hands-on-keys.

### Acceptance criteria
- [ ] Space/Enter flips the card; `->` or `2` = "Got it"; `` or `1` = "Again".
- [ ] Shortcuts only act in study mode and don't fire while typing in an input.

### Implementation plan
1. **`app.js`** - add a single `document.addEventListener("keydown", onKey)`.
2. **`onKey(e)`** - `if (state.mode !== "study") return; if (e.target.matches("input,textarea")) return;` then `switch(e.key)`: `" "`/`"Enter"` -> `flip()`; `"ArrowRight"`/`"2"` -> `grade(true)`; `"ArrowLeft"`/`"1"` -> `grade(false)`. Call `e.preventDefault()` for handled keys.
3. The existing flashcard element already has `keydown` for Enter/Space; keep but ensure no double-handling (either remove the element-level one or guard it).

### How to test
Enter study mode, press Space (flips), `->` (advances as known), `` (marks again); confirm typing in the manage form is unaffected.

---

## Story 5: Import a deck from pasted CSV
**As a** user, **I want** to bulk-add cards, **so that** I can build a deck quickly.

### Acceptance criteria
- [ ] A "Bulk import" area accepts lines of `front, back` (optionally `front, back, deck`).
- [ ] Importing creates one card per non-empty line; the deck defaults to a chosen deck name.
- [ ] Malformed lines are skipped and a summary reports how many were added.

### Implementation plan
1. **`index.html`** - add a `<details>` panel in manage mode with a `<textarea id="bulk-input">`, a deck-name input, and an "Import" button.
2. **`app.js`** - on import: split the textarea by `\n`; for each line `split(",")`; require at least front and back; build `{ id: crypto.randomUUID(), front, back, deck: parts[2]?.trim() || deckName, known:false, misses:0 }`; push valid ones to `state.cards`.
3. **`app.js`** - `saveCards()`, clear the textarea, `render()`, and `showMessage("Added N cards.")` (count valid lines).

### How to test
Paste three lines (one malformed), import, confirm two cards added under the chosen deck and the malformed line skipped.

