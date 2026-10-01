# Codebase map and reading order

[Course index](README.md)

## The problem this project solves

Malformed line values could reach arithmetic or database operations, including fractional quantities, impossible calendar dates and unsupported decimal precision. The improvement you will study is: Invoices validate client UUIDs, real issue dates, bounded line arrays, whole positive quantities, two-decimal prices and tax from 0 to 100. Parent and line writes commit together, and a late line failure leaves no partial invoice change.

## Data model

An invoice is a parent row referencing a client. Line rows reference that invoice and contain description, quantity and unit price. Totals derive from the submitted lines and tax rate. The current UI creates invoices; API update behavior is exercised separately by regression tests.

An object is a named collection of fields. An array is an ordered collection of values. An id answers “which record?”; an index answers “where is it in this array right now?” Those questions are different whenever the list can be filtered, reordered or edited. Persisted data is the form that must survive a process/page restart. Derived data can be recomputed from that persisted state.

## Trace one action

1. The React handler collects form or filter state.
2. client/src/api.ts sends typed client data as untyped JSON over HTTP.
3. server/src/index.ts validates runtime values at the server boundary.
4. server/src/db.ts supplies a pool or one transaction client for the relevant SQL.
5. PostgreSQL constraints and the transaction boundary protect the stored relationships described in this lesson.
6. The API maps rows to its JSON representation and React renders the observed result.

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

1. [server/src/index.ts](../server/src/index.ts): locate `parseInvoice` and read its inputs, branches and return/side effects.
2. [test/feature.test.ts](../test/feature.test.ts): read the scenario names before the helper code.
3. The root [README](../README.md): connect setup and the larger application workflow.

## Source navigation

- [client/src/App.tsx](../client/src/App.tsx)
- [client/src/api.ts](../client/src/api.ts)
- [client/src/main.tsx](../client/src/main.tsx)
- [client/src/vite-env.d.ts](../client/src/vite-env.d.ts)
- [server/src/db.ts](../server/src/db.ts)
- [server/src/index.ts](../server/src/index.ts)
- [shared/types.ts](../shared/types.ts)
- [vite.config.ts](../vite.config.ts)

## A practical reading technique

At each function boundary, write down the value coming in, the value going out and any side effect. A side effect includes a storage write, SQL query, network request, timer registration or DOM update. If a function calls another function, inspect only that next dependency until you can finish the chosen trace. Return to unrelated files later.

For this lesson, start with: **Create two units at 12.34, zero tax, issued 2028-02-29: total 24.68. Reject quantity [2], a three-decimal price and 2027-02-29. Force a replacement line insert to fail and verify the old invoice and lines remain intact.** Mark where the id, time, amount or other important value changes representation. For example, JSON serializes values into text; a date field may be a calendar string; SQL aggregates may return a different type from individual rows. Representation changes are common bug locations.

## Check your understanding

Without reading the solution, answer: Who owns the mutable state? Which input is untrusted? Which function first decides whether the operation is valid? What survives reload or restart? What observation would prove that the operation partially failed? Point to a source file for each answer, rather than describing a generic app from memory.
