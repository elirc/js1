# Poll Studio Codebase Guide

This app teaches dynamic form fields, a common source of junior-engineer bugs. The number of option inputs changes at runtime, but the data still needs to stay predictable.

## Code Map

- `index.html`: poll form, dynamic option area, poll list.
- `styles.css`: option rows, result bars, cards.
- `app.js`: draft options, poll CRUD, voting, percentages.

## Dynamic Draft State

```js
const state = {
  polls: loadPolls(),
  draftOptions: ["", ""],
  editingId: null
};
```

The option inputs are not hard-coded. They are rendered from `draftOptions`, which lets the form grow and shrink.

## Turning Inputs Into Records

```js
const options = state.draftOptions
  .map((option) => option.trim())
  .filter(Boolean)
  .map((label) => ({ id: crypto.randomUUID(), label, votes: 0 }));
```

This is a clean data pipeline: normalize, remove invalid values, transform into domain objects.

## Percentage Calculation

```js
const percent = totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100);
```

Always handle the zero case. Division-by-zero bugs appear often in dashboard and analytics work.

## Preserving Votes During Edit

If an edit keeps the same option, preserve vote counts. That is a business decision. In real codebases, these decisions should be documented in comments or tickets.

## Extension Practice

- Add poll closing/opening.
- Add single-vote protection.
- Add option reordering.
- Add validation messages next to individual fields.
- Store `createdAt` and sort newest first.

Dynamic forms are easier when one array is the source of truth.
