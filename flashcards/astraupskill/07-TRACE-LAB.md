# Trace lab: A session is a snapshot, not a live filter

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const cards = [{id:'a',known:false},{id:'b',known:false}];
const order = cards.filter(card => !card.known).map(card => card.id);
// After grading a, keep order ['a','b']; advance cursor from 0 to 1.
// Refiltering to ['b'] before advancing would skip b.
```

## Follow the boundary with concrete values

This app has no HTTP layer, so the six boundaries a server request crosses appear here as six
in-process ones. They are the same six responsibilities: raise an intent, translate it into a
domain identity, decide whether it is allowed, build the new value, persist it, publish it.
Walk them in order, writing the concrete values at each hand-off before you run anything.

**Boundary 1 — the input surface (`index.html:72-74`, listeners at `app.js:74-77`).**
The only three things the study view can raise are `flip`, `grade(false)` and `grade(true)`.
`index.html:72` is `#again-button`, `:73` is `#flip-button`, `:74` is `#known-button`; the
listeners at `app.js:74-77` translate a click into exactly one call with one boolean argument.
Nothing about *which card* crosses this boundary — the button does not know the card id.
Write down what a click carries: a boolean, and nothing else.

**Boundary 2 — intent to domain identity (`currentStudyCard`, `app.js:232-235`).**
`grade` immediately calls `currentStudyCard()`, which reads `state.studyOrder[state.studyIndex]`
to get an **id**, then finds the record in `state.cards` by that id. This is where a position
(`studyIndex`, an answer to "where in this session am I?") becomes an identity (`card.id`, an
answer to "which record?"). Record both values. With the fixture below, at entry
`studyIndex` is 0, `studyOrder` is `['a']`, and the id is `'a'`.

**Boundary 3 — the guard (`app.js:245`).**
`if (!card || !state.flipped) return;` is this project's validator. It rejects two different
situations with the same early return: the session is finished or empty (`card` is
`undefined`, because `studyOrder[studyIndex]` is out of range), and the answer has not been
revealed (`state.flipped` is `false`). Note what has *not* happened yet at this line: nothing
has been written and nothing has been mutated, so a rejection here is free. The disabled
buttons at `app.js:274-275` are a courtesy; this line is the rule.

**Boundary 4 — building the candidate value (`app.js:246`).**
`state.cards.map((item) => item.id === card.id ? { ...item, known } : item)` constructs a whole
replacement array; it does not assign `card.known = known`. That is the change: the old code at
`git show 606e0e6:flashcards/app.js` (line 236) mutated the live record first and saved afterwards. Write out `next`
for the fixture — one object differs from `state.cards` by one field, and `state.cards` itself
is still untouched at this point.

**Boundary 5 — persistence (`app.js:247-253`).**
`localStorage.setItem(STORAGE_KEY, JSON.stringify(next))` inside `try`. This is the only place
in `grade` that can fail, and the `catch` at `:249` sets `state.studyError`, re-renders and
returns **before** any of the three publish statements. Say explicitly which four values are
guaranteed unchanged after a rejection here: `state.cards`, `state.studyIndex`, `state.flipped`
and the serialized bytes in `localStorage`.

**Boundary 6 — publish and render (`app.js:254-258`, then `renderStudy` at `app.js:261`).**
Only after the write returns do `state.cards = next`, `state.studyError = ""`,
`state.studyIndex += 1` and `state.flipped = false` run, in that order. `renderStudy` then
reads `total = state.studyOrder.length` and, when `currentStudyCard()` is `undefined`,
branches at `app.js:269-273` on whether `total` is zero: an empty eligible set says "No matching
cards", a finished session says "Session complete". Both have no current card; only the message
distinguishes them. Write both strings down before you run the test.

### Rows to fill in

Write four rows: initial cursor 0; reveal a; grade a and move to 1; grade b and move to 2. The
last cursor equals `studyOrder.length` and means complete. A storage rejection inserts a branch
before cursor movement: neither knowledge state nor cursor changes. Repeat `grade` after
completion and explain why boundary 3 makes it harmless. Now change decks during a session:
`deckFilter`'s listener at `app.js:53-57` calls `startStudy(false)` rather than `render()`, so
restarting is a deliberate reset at boundary 2, not an order retaining ids from the previous
deck.

## Connect the model to real code

Open [app.js](../app.js) beside [test/study.test.cjs](../test/study.test.cjs). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

JS contains a unknown and b known; CSS contains c unknown. Select JS and unlearned-only: the session contains just a. Reveal and mark it known: progress becomes Completed 1 of 1 and grading is disabled. Restarting now finds no eligible cards. A rejected write instead keeps a at index zero.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
