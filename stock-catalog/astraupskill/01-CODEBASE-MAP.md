# Codebase map and reading order

[Course index](README.md)

## The problem this project solves

Fractional/infinite paging values were insufficiently normalized, sort ties lacked a unique tie-breaker and malformed prices reached unsafe paths. The improvement you will study is: Paging normalizes to bounded whole values. Sort ties use ids. Names/categories are bounded text, prices are finite and bounded, and stock is a nonnegative whole count. Existing last-page clamping has regression coverage.

## Data model

Products have id, name, category, price and stock. The API returns items and page metadata. The client holds one page; the repository itself remains in memory.

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

1. [server/server.js](../server/server.js): locate `createProductRepository` and read its inputs, branches and return/side effects.
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

For this lesson, start with: **Three same-price products at two per page give stable ids on page 1. Page 999 becomes page 2 with one item. Infinite/fractional page inputs use defaults; infinite prices and fractional stock are rejected.** Mark where the id, time, amount or other important value changes representation. For example, JSON serializes values into text; a date field may be a calendar string; SQL aggregates may return a different type from individual rows. Representation changes are common bug locations.

## Check your understanding

Without reading the solution, answer: Who owns the mutable state? Which input is untrusted? Which function first decides whether the operation is valid? What survives reload or restart? What observation would prove that the operation partially failed? Point to a source file for each answer, rather than describing a generic app from memory.
