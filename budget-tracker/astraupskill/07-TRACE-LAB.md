# Trace lab: Represent money deliberately

[Course index](README.md)

## Work the reduced example first

The following example isolates one idea. The linked project source remains the executable implementation; do not paste this teaching model over it.

```javascript
const tenCents = 10;
const twentyCents = 20;
console.log(tenCents + twentyCents); // 30
console.log((tenCents + twentyCents) / 100); // 0.3 for formatting
// Production parseCents validates text before constructing these integers.
```

## Follow the boundary with concrete values

There is no HTTP layer here, so the six boundaries a server request crosses appear as six
in-process ones - and money changes representation at four of them, which is the point of the
whole lesson. Trace typing `12.50` into `#amount` and pressing Save.

**Boundary 1 - the input surface (`index.html` form, listener via `form.addEventListener`).**
`#amount` is `<input type="number">`, and the value you read from it is **always a string** -
`amountInput.value` is `"12.50"`, not `12.5`. That string is the untrusted input, and it can be
`""` (the field was blank), `"1e3"` (a number input accepts scientific notation), `"Infinity"`
or `"-1"`. Write down the five strings you can get out of that one field before the app has
looked at any of them.

**Boundary 2 - text to integer cents (`parseCents`, `app.js:193-198`).**
The decisive guard, and the reason this project exists. It does **not** call `Number()`. The
regex `/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/` decides the whole question of "is this money?" before
any arithmetic: no leading `+`/`-`, no leading zeros, at most two decimals, no exponent, no empty
string. Then `Number(whole) * 100 + Number(fraction.padEnd(2, "0"))` builds the integer. Walk
`12.50`: whole `"12"` → 1200, fraction `"50"` → 50, total **1250**. Walk `12.5`: `padEnd` makes
the fraction `"50"` as well, so also 1250 - the same money written two ways gives one value.
Walk `12.005`: rejected by the regex, **not** silently rounded. Then the bounds:
`Number.isSafeInteger(cents) && cents > 0 && cents <= 99999999999`. Note that `> 0` is what
rejects `"0"`, and hold that thought - `02-CONCEPTS.md` argues about it.

**Boundary 3 - cents back to dollars (`saveTransaction`, `app.js:93`).**
`amount: parseCents(amountInput.value) / 100`. This is the compatibility boundary and it is one
character wide. The stored schema is still a **dollar number**, because the records already in
`localStorage` are dollar numbers and this change did not migrate the schema. So the exact
integer 1250 becomes the float 12.5, and `NaN / 100` is `NaN`, which is exactly what the guard
at `app.js:97` then rejects with `Number.isFinite`. Write down both: the value on success and
the value on failure.

**Boundary 4 - normalization of what is already on disk
(`loadTransactions` / `normalizeAmounts`, `app.js:58-83`).**
New input is bounded to the cent, but the records loaded at startup were written by an older
build and are not. `normalizeAmounts` snaps each stored `amount` to `Math.round(x * 100) / 100`
once, as the data enters the program, so the row and the ledger cannot disagree. Note what it
deliberately does **not** do: it does not write. A read that can fail a write is a bad trade;
the normalized value reaches storage on the next successful `commitTransactions`. Write the
value of `0.105` before and after this boundary.

**Boundary 5 - persistence, then publication (`commitTransactions`, `app.js:205-210`).**
`localStorage.setItem(...)` inside `try`; only on success does `transactions = next` run and
`true` come back. Every one of create, edit and delete goes through it and every caller does
`if (!commitTransactions(next)) return;` (`app.js:105`, `app.js:128`). List the four things that
are guaranteed unchanged after a rejected write: the `transactions` array, the stored bytes, the
form contents (`resetForm` is called *after* the guard), and the rendered rows.

**Boundary 6 - totals and formatting (`renderTransactions`, `app.js:150-161`).**
Totals are summed as integers - `summary[transaction.type] += Math.round(transaction.amount * 100)`
- and divided by 100 only at the moment of display, then handed to `Intl.NumberFormat`. Two
separate ideas: arithmetic in the smallest unit (so `0.1 + 0.2` cannot produce
`0.30000000000000004`), and formatting as the last step. Also note the *scope*: the totals are
computed from `transactions`, the whole ledger, while the rows come from
`getVisibleTransactions()`. Filtering to one type changes the rows and **not** the totals. That
is a deliberate choice; label it in the UI rather than assuming every dashboard number follows
the filter.

## Connect the model to real code

Open [app.js](../app.js) beside [test/money.test.cjs](../test/money.test.cjs). Identify the caller, the input representation, the decisive guard or transition, and the observable result. Write the value at each step of this actual fixture before executing it:

Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

If the observation differs from your prediction, find the first changed representation or branch. Do not jump straight to altering the expected assertion. Explain whether the fixture, implementation or your mental model was wrong.

## Independent checkpoint

Change one boundary value and write a new expected-state table. Include an ordinary case and a failure or empty case. Describe which data should remain identical and which visible feedback should change. Finish with a five-minute walkthrough explaining the responsibility of each relevant file and one explicitly unsupported scenario.
