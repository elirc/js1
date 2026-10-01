# Codebase map and reading order

[Course index](README.md)

## The problem this project solves

NaN cooking values could evade checks, ingredient objects were coerced into text, and repeated labels were duplicated. The improvement you will study is: Cooking minutes and servings are bounded whole numbers. Ingredients must be 1-100 nonempty bounded strings. Trimming and case-insensitive deduplication preserve first spelling. Invalid nested payloads are rejected before mutation.

## Data model

Recipes have id, name, category, cookTime, servings, ingredients[] and notes. Ingredients are free-form text, not structured quantities. Storage is in memory.

An object is a named collection of fields. An array is an ordered collection of values. An id answers “which record?”; an index answers “where is it in this array right now?” Those questions are different whenever the list can be filtered, reordered or edited. Persisted data is the form that must survive a process/page restart. Derived data can be recomputed from that persisted state.

## Trace one action

1. The React event handler reads controlled form or filter state.
2. client/src/api.js serializes the request to the Express API.
3. server/server.js validates caller-controlled fields and normalizes accepted values.
4. The repository method reads or changes its in-memory records.
5. The route returns JSON or a bounded validation error.
6. React reloads or renders the response; server restart reconstructs seed state.

```mermaid
flowchart LR
    A[Input or user action] --> B[Validate and normalize]
    B --> C[Compute intended change]
    C --> D[Commit at the state boundary]
    D --> E[Return or render observed state]
    B --> F[Explain invalid input]
    D --> G[Handle a failed write]
```

This diagram names responsibilities, not necessarily separate files. A small browser program can keep them in app.js. A larger API spreads them across controllers, services and models. Follow the actual sequence above rather than assuming every repository has the same architecture.

## Where to read first

1. [server/server.js](../server/server.js): locate `validateRecipe` and read its inputs, branches and return/side effects.
2. [test/api.test.js](../test/api.test.js): read the scenario names before the helper code.
3. The root [README](../README.md): connect setup and the larger application workflow.

## Source navigation

- [client/src/App.jsx](../client/src/App.jsx)
- [client/src/api.js](../client/src/api.js)
- [client/src/main.jsx](../client/src/main.jsx)
- [server/server.js](../server/server.js)
- [vite.config.js](../vite.config.js)

## A practical reading technique

At each function boundary, write down the value coming in, the value going out and any side effect. A side effect includes a storage write, SQL query, network request, timer registration or DOM update. If a function calls another function, inspect only that next dependency until you can finish the chosen trace. Return to unrelated files later.

For this lesson, start with: **[" Salt ", "salt", "Water"] saves as ["Salt", "Water"]. Servings "4" becomes numeric 4 without changing id. Object ingredients, blanks, fractional servings and boolean cooking time fail.** Mark where the id, time, amount or other important value changes representation. For example, JSON serializes values into text; a date field may be a calendar string; SQL aggregates may return a different type from individual rows. Representation changes are common bug locations.

## Check your understanding

Without reading the solution, answer: Who owns the mutable state? Which input is untrusted? Which function first decides whether the operation is valid? What survives reload or restart? What observation would prove that the operation partially failed? Point to a source file for each answer, rather than describing a generic app from memory.
