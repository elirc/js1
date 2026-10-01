# Codebase map and reading order

[Course index](README.md)

## The problem this project solves

Vote preservation depended on option count and position. Removing a row could reset other votes, and a failed write could leave memory ahead of storage. The improvement you will study is: Draft options carry stable ids. Surviving options retain their votes; new options start at zero. Blank or duplicate labels are rejected. Save, vote, reset and delete publish state only after storage succeeds.

## Data model

A poll has id, question and options. An option has its own id, text and votes. Drafts contain id/text; they become the saved poll only at commit. Data lives under js1-poll-studio in localStorage.

An object is a named collection of fields. An array is an ordered collection of values. An id answers “which record?”; an index answers “where is it in this array right now?” Those questions are different whenever the list can be filtered, reordered or edited. Persisted data is the form that must survive a process/page restart. Derived data can be recomputed from that persisted state.

## Trace one action

1. The browser loads index.html and app.js.
2. An event handler reads the selected record and current form controls.
3. Validation checks the intended operation before calculating candidate state.
4. The shared save/move boundary attempts the localStorage write.
5. A successful write publishes the candidate and rerenders; a rejected write keeps the promised previous state.
6. A fresh read after reload reveals the saved result.

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

1. [app.js](../app.js): locate `handleSubmit` and read its inputs, branches and return/side effects.
2. [test/polls.test.cjs](../test/polls.test.cjs): read the scenario names before the helper code.
3. The root [README](../README.md): connect setup and the larger application workflow.

## Source navigation

- [app.js](../app.js)

## A practical reading technique

At each function boundary, write down the value coming in, the value going out and any side effect. A side effect includes a storage write, SQL query, network request, timer registration or DOM update. If a function calls another function, inspect only that next dependency until you can finish the chosen trace. Return to unrelated files later.

For this lesson, start with: **Remove Mobile app from the starter poll. Public API retains 7 votes and Dark mode retains 2, for 9 total. Duplicate labels API/api are rejected. A failed write preserves both the old poll and the current draft.** Mark where the id, time, amount or other important value changes representation. For example, JSON serializes values into text; a date field may be a calendar string; SQL aggregates may return a different type from individual rows. Representation changes are common bug locations.

## Check your understanding

Without reading the solution, answer: Who owns the mutable state? Which input is untrusted? Which function first decides whether the operation is valid? What survives reload or restart? What observation would prove that the operation partially failed? Point to a source file for each answer, rather than describing a generic app from memory.
