# Poll Studio CRUD

A vanilla JavaScript poll builder for practicing **dynamic field arrays** —
forms where the number of inputs changes at runtime.

## What it practices

- Adding and removing option rows (with min/max bounds)
- Rendering inputs from a `draftOptions` array and keeping it in sync on `input`
- Aggregating votes and computing percentages
- Drawing simple bar charts with a CSS-width span (no libraries)
- Preserving existing votes when an edit keeps the same option count
- CRUD on polls with localStorage persistence

## Things to try

1. Click an option bar to cast a vote and watch the bars re-scale.
2. Add validation that blocks duplicate option text.
3. Add a "share of leader" highlight on the winning option.

Open `index.html` in a browser to run it.
