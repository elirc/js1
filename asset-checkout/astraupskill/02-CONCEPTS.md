# Concepts explained from first principles

[Course index](README.md)

## The central idea: atomic status transitions, consistent pages and calendar dates

Follow one concrete command: change "Camera kit for field interviews" from Available to Checked Out. The first successful command represents a real transition and adds one status event. Sending Checked Out again compares equal to current state, so it returns the record without adding another status event. Created, updated and note entries remain separate kinds; counting every timeline row would give the wrong assertion. This guarantee concerns repeated current values, not global request deduplication. After an intervening transition, requesting Checked Out can legitimately create a new event.

The handler obtains one database client, begins a transaction and reads the record FOR UPDATE. A second writer waits for that row, then compares against its latest committed status. The update and activity insert use the same client, so an audit-insert failure rolls back the status too. The test installs a temporary trigger to force that late failure. Separately, the list transaction counts and fetches under one repeatable-read snapshot. It does not freeze the dataset across later HTTP requests. PostgreSQL DATE values are returned as calendar strings through a type parser, avoiding accidental local-midnight conversion.

Validation belongs at the API boundary even when the React controls constrain input. An object is not a valid title, an unknown priority is not silently accepted, and 2027-02-29 is not a real date. Normalization may trim a valid string, but should not stringify an object into a misleading title. For paging, count matching rows before clamping a request such as page 999. Sort by the selected field and then id so ties are deterministic on an unchanged dataset. The scaffold accepts its named statuses; it does not enforce a domain approval graph or actor permissions. A Available-to-Checked Out label change alone does not implement every real-world rule for an equipment checkout and its custodian.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Typed and bounded inputs protect edits, real calendar dates round-trip, page numbers clamp and equal sort values use an id tie-breaker. Repeating the current status creates no extra status history. Status and audit writes use one row-locked transaction; count and rows share a repeatable-read snapshot. Seed dates map to the intended column. The shared toolbar now uses two flexible columns so its search field remains readable beside the form and activity panels.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

This app represents an equipment checkout and its custodian. A record uses generic fields id, title, owner, category, status, priority, amount, dueDate and notes. Categories are Laptop, Camera, Tooling, Vehicle. Statuses are Available, Checked Out, Maintenance, Retired. The UI gives these shared fields domain-specific labels. Return date is represented as a YYYY-MM-DD calendar string, not an instant. PostgreSQL items and activity_entries tables persist records and their child history.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Two representation bugs lived in this project before the change, and both are worth more than a footnote.

**The seed that silently nulled every date.** `server/db/schema.sql` seeds from JSON with `json_to_recordset(...) AS x(..., due_date text, ...)`. `json_to_recordset` matches JSON keys to column names *by name*, and the JSON key is `dueDate`. PostgreSQL folds unquoted identifiers to lower case, so `due_date` never matched `dueDate` and every seeded `due_date` was `NULL`; nothing failed, the column was just empty. The fix is the quoted identifier you now see: `"dueDate" text` in the record definition and `"dueDate"::date` in the `SELECT`. Rule: when a name comes from outside SQL, quote it.

**The date that became a timestamp.** `pg` parses the `date` type (OID 1082) into a JavaScript `Date` at local midnight, so `2028-02-29` read back on a machine west of UTC became `2028-02-28T...`. `server/src/db.ts:6` `pg.types.setTypeParser(1082, value => value)` turns that off: a date column now arrives as the string `2028-02-29`, which is what the API promised. Before the parser: `SELECT due_date FROM items` -> `2028-02-29T05:00:00.000Z` (in JavaScript); after: `'2028-02-29'`. The first test's `dueDate` round-trip assertion is what pins it.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
