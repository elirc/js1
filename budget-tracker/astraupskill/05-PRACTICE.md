# Guided and independent practice

[Course index](README.md) · [Solutions](06-SOLUTIONS-AND-REVIEW.md)

## Exercise 0 — reconstruct the existing behavior

Draw the data shape and trace this fixture without running it:

Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

Write one assertion for success and one for a rejected or failed operation. Then read the existing test and compare its observation with yours. Explain why a message alone would or would not prove the invariant.

## Exercise 1 — guided extension

Replace the one-size-fits-all message at `app.js:97-99` with feedback that names the rule the
user broke.

Right now every rejection prints the same sentence: "Use a description, category, real date, and
a positive amount with at most two decimal places (maximum 999999999.99)." A user who typed
`1.005` and a user who left the category blank read the same paragraph and have to find
themselves in it.

Write the acceptance examples first, as a table: `""` → "Enter an amount."; `"1.005"` → "Amounts
have at most two decimal places."; `"1e3"` → "Enter a plain number, like 1000 or 1000.00.";
`"1000000000"` → "The maximum amount is 999,999,999.99."; a blank category → "Choose a
category."

Then the design decision that makes this exercise worth doing: **where does the reason come
from?** The tempting answer is to re-test each condition in `saveTransaction`, which gives you a
second copy of the rules in `parseCents` (`app.js:193-198`) and guarantees they will disagree
within a month - someone will loosen the regex and forget the handler. Have `parseCents` return
the reason instead: `{ cents }` or `{ error: "too-many-decimals" }`. One place decides what money
is; the handler only maps a reason to a sentence.

Regression to add: assert that a rejected submit still writes nothing, for *each* new message.
The existing suite would not notice a refactor that produced a nicer message and a corrupted
ledger.

## Exercise 2 — independent variation

Add a per-category breakdown that adds up **exactly** to the existing totals.

Close chapter 3. Describe your design in three sentences before coding: which data you reuse
(`transactions`, not `getVisibleTransactions()` - or the other way round, but say which and why),
the rule it must preserve (the sum of the category totals equals `#income-total` plus
`#expense-total`, to the cent, for any fixture), and the observation that proves it.

Two traps, both worth meeting:

1. **Accumulate cents, not dollars.** `total += transaction.amount` is fine for three rows and
   wrong for three hundred. Build the fixture that breaks it: 100 rows of `0.01` in one category
   and 1 row of `0.1` in another, and assert the two category totals sum to `$1.10` exactly.
   Follow `renderTransactions` (`app.js:153`) and round on the way in, divide on the way out.
2. **Decide the scope consciously.** The existing `#income-total` is a whole-ledger number: it
   ignores the type filter and the search box entirely. If your category totals follow the
   filter, then filtering to "income" makes the breakdown stop matching the totals beside it,
   and a user will report that as a bug. Whichever you choose, put the scope in the label -
   "All transactions" or "Matching the current filter". The existing dashboard does not, and
   that is a defect this exercise should fix, not copy.

## Exercise 3 — failure-focused extension

Prove a failed delete changes nothing - all four of the things it must not change.

`deleteTransaction` (`app.js:127-132`) is one line of logic:
`if (!commitTransactions(transactions.filter(...))) return;`. Write the test that would catch
someone reordering it.

Capture before the operation: `app.evaluate("transactions.length")`, the raw string
`app.w.localStorage.getItem("js1-budget-tracker")`, and the text of `#message`. Stub
`Storage.prototype.setItem` to throw, call `deleteTransaction(id)` for a row that exists, and
assert four things after:

1. the in-memory array still has the same length **and** still contains that id;
2. the stored string is **byte-identical** (compare the strings, not re-parsed objects - a
   re-serialization with different key order would pass the weaker check);
3. `resetForm()` did not run - the editor is untouched, which matters because a real user may
   have been mid-edit when the delete failed;
4. `#message` matches `/Could not save/`, not the "Transaction deleted." that a naive
   implementation prints before checking.

Now break it on purpose: move `resetForm()` and `setMessage("Transaction deleted.")` above the
guard and re-run. Exactly one assertion should fail for each thing you broke; if a single
assertion catches both, your test is too coarse. Then restore, and write down the recovery
behaviour the user actually gets: an error they can act on, with their data and their form
intact - not an exception in a console they will never open.

## Exercise 4 — stretch design

Design a versioned migration from the dollar-number schema to a cent-integer schema.

Stop at a design note plus a test plan. The current guarantee is narrow and you should state it
exactly: new amounts are bounded to two decimals by `parseCents` (`app.js:193-198`), arithmetic
is done in cents (`app.js:153`), and records already on disk are snapped to the cent **in
memory** by `normalizeAmounts` (`app.js:71-83`) without ever being written back. That is not a
migration; it is a shim that makes the ledger self-consistent while leaving the stored schema
alone.

The stronger guarantee you want: `amount` is an integer number of cents in storage, so no float
ever round-trips.

Your note must answer four things:

1. **How you know which version a stored record is.** "Multiply every amount by 100 on load" is
   the naive plan and it double-converts on the second run, turning $12.50 into $1250.00 - once
   silently, for every user, with no way to tell afterwards. Store an envelope:
   `{ schemaVersion: 2, transactions: [...] }`, and write the conversion as an explicit
   `v1 → v2` function.
2. **What happens to a record you cannot convert** - `amount` is a string, negative, `null`, or
   absent. Quarantine it into a `problems` array the UI can show? Refuse to start? Both are
   defensible; silently coercing is not, because that is how a ledger quietly changes value.
3. **When the write happens.** On load - which means a read can now fail a write, and a user with
   a full disk cannot open their budget at all - or lazily on the next successful commit, which
   is what `normalizeAmounts` chose. Say which and why.
4. **How you would roll back** if version 2 shipped with a bug. You cannot, unless you kept the
   original array. Decide whether that is worth the storage.

Test plan, not implementation: a v1 fixture, a v2 fixture, a v1 fixture run through the migration
**twice** (the most important test - it must be idempotent), and one unconvertible record.

## Exercise 5 — teach the codebase

Give a five-minute walkthrough to another learner, or record yourself. Use [app.js](../app.js) and one test. Explain the application problem, the data model, the call path, one success case, one failure case and the tradeoff. Ask the listener to predict a new input’s result. Their questions reveal which part of your explanation needs work.

## Exercise 6 — review your own change

Inspect the diff as if you were a teammate encountering it for the first time. Remove unrelated edits. Check names, error feedback, preservation of ids/data, and the order of writes. Update the learning note if the actual code differs from the plan. Record what was tested and what remains an assumption.

## Completion rubric

Score each item 0 (cannot explain), 1 (can explain with help) or 2 (independent): data model, control flow, validation, persistence/failure behavior, regression test design, and tradeoff explanation. Aim for 2 on the first five before taking the stretch exercise. Revisit a weak area with a changed-input example rather than rereading every page.
