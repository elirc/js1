# Flashcards Codebase Guide

This project is more than CRUD: it shows the same records in two modes, management and study. Real apps often have multiple views over the same data.

## Code Map

- `index.html`: tab buttons, manage view, study view, form, list.
- `styles.css`: tab states, card presentation, study controls.
- `app.js`: card CRUD, deck filtering, study-session state, shuffling.

## State Shape

```js
const state = {
  cards: loadCards(),
  mode: "manage",
  deck: "All",
  editingId: null,
  studyOrder: [],
  studyIndex: 0,
  flipped: false
};
```

The key learning: stored data and session data are different. `cards` persists; `studyOrder`, `studyIndex`, and `flipped` are temporary UI state.

## Derived Decks

```js
const decks = [...new Set(state.cards.map((card) => card.deck))].sort();
```

This computes deck options from existing cards. In larger systems, derived navigation options can come from data rather than hard-coded lists.

## Study Session as a State Machine

```js
state.studyOrder = shuffle(getVisibleCards().map((card) => card.id));
state.studyIndex = 0;
state.flipped = false;
```

Starting a session resets all session-specific state. This same principle applies to checkout flows, onboarding flows, and multi-step forms.

## Fisher-Yates Shuffle

```js
for (let index = copy.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(Math.random() * (index + 1));
  [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
}
```

This is a real algorithm. Learn to recognize places where a named algorithm is clearer and safer than improvised logic.

## Extension Practice

- Add difficulty levels.
- Track correct/incorrect answers.
- Add spaced repetition dates.
- Add import/export JSON.
- Split study logic into a separate module.

When state grows, consider grouping related behavior into modules before the file becomes hard to scan.
