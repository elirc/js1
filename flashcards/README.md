# Flashcards CRUD

A vanilla JavaScript flashcard app for practicing **view modes and a study
flow** — the same data shown two different ways.

## What it practices

- A `mode` flag (`manage` / `study`) that swaps which view is visible
- A study session as its own state: an order array, a current index, and a
  flipped boolean — separate from the stored cards
- Deriving deck names from the data and feeding both a filter and a `<datalist>`
- Shuffling with a Fisher–Yates loop
- Self-grading that writes a `known` flag back to each card
- Keyboard support (Enter/Space to flip) for accessibility
- CRUD on cards with localStorage persistence

## Things to try

1. Add a "study only cards I haven't learned" toggle.
2. Spaced repetition: track how many times each card was missed and resurface
   the hardest ones first.

Open `index.html` in a browser to run it.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): session snapshots, state transitions and persistence failure, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
