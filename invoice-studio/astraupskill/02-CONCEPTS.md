# Concepts explained from first principles

[Course index](README.md)

## The central idea: decimal input contracts and transactional parent/child writes

An input contract must distinguish numbers, numeric strings, empty strings, arrays and objects. JavaScript coercion can turn [] into zero and [2] into two; neither is an acceptable quantity payload. Validate primitive shape and decimal precision before arithmetic. Quantity is a positive whole number, whereas unit price allows at most two decimal places. A date input represents a calendar label, so 2028-02-29 is valid and 2027-02-29 is not.

For two units at 12.34 and zero tax, the total is 24.68. The implementation rounds the aggregate to two decimal places; it is a teaching calculation, not a complete accounting policy for every currency or tax regime. Parent and child writes use one transaction. Updating the parent and deleting old lines before a failed replacement line must roll back all three steps. The failure test injects a database trigger in a disposable schema so it exercises a late database failure instead of stopping at input validation.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Invoices validate client UUIDs, real issue dates, bounded line arrays, whole positive quantities, two-decimal prices and tax from 0 to 100. Parent and line writes commit together, and a late line failure leaves no partial invoice change.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Money and dates are where this project earns its keep. `decimal(value, maximum)` (`server/src/index.ts:272`) accepts a number or a string that matches `/^\d+(?:\.\d{1,2})?$/` and is at most `maximum`: so `'2.50'`, `2.5` and `12.34` pass, `0.001` (three decimals), `-1` (sign), `1e3` (exponent) and `' 2'` (whitespace) fail. Normalization then converts with `Number(...)`. The quantity guard checks the shape first (`typeof`) and the value second (`Number.isSafeInteger`, the upper bound). The issue date is a calendar label validated by round-tripping through `Date.parse` and `toISOString`, so `2027-02-29` (not a leap year) is rejected while `2028-02-29` is kept.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

PostgreSQL stores `unit_price`, `subtotal`, `tax` and `total` as `numeric(12,2)`: exact decimal, two places. JavaScript has one `number` type, binary floating point: `0.1 * 2 * 1.1` is `0.22000000000000003`. The two disagree exactly where invoices care. The rule this project follows: compute in JavaScript, then `Math.round(x * 100) / 100` *before* the value is stored or shown, so the number that reaches `numeric(12,2)` is already a cent value and the column does not round silently. The first test's fixture (`0.1 x 2 at 10%`) and the new fourth test (`12.34 x 2 at 0%`, total `24.68`) are the two ends of that rule. Exercise 4 goes further: store integer cents and never let a float near money.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
