# Testing and debugging

[Course index](README.md)

## Run the checks

Open index.html in a browser. From this project folder run `npm install`, then `npm test` with Node 22 or a compatible later version for the DOM tests.

```text
npm test
```

## What the test suite proves

Read [test/money.test.cjs](../test/money.test.cjs). The suite targets **numeric parsing, representations and persisted state** and uses the worked fixture:

Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

In this project, jsdom runs the actual app.js against its HTML. The helper supplies browser APIs missing from jsdom and a controllable timer clock. It does not replace the app’s business functions. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `parseCents` and inspect input types as well as values.
4. Follow validation branches, noting whether any state or persistence changed before rejection.
5. Inspect the write result and the subsequent render/response. Separate storage correctness from display correctness.
6. Add a regression reproducing the failure, make the smallest justified fix, then run the focused suite and relevant broader checks.

Avoid changing several layers at once when you do not yet know where the failure starts. A correct backend with a stale UI needs a different fix from a malformed query or an invalid saved document.

## Failure experiments

- Reuse the invalid fixture from the tests and verify no unintended records or fields change.
- Reload or restart after a successful operation to distinguish persistence from temporary screen state.
- Repeat the operation and explain whether it should be idempotent, rejected or intentionally create another record.
- Simulate the relevant timing or storage failure only in a disposable fixture. Restore normal behavior after the experiment.

## Reading an assertion failure

“Expected 3, received 4” is evidence about one observation, not a complete diagnosis. Ask whether the fixture created an extra record, the operation ran twice, an old record survived, or the assertion looked at an unfiltered collection. Start from the state table and trace the first point where the actual value diverges. A stack trace identifies where the program noticed a problem, which may be later than the code that caused it.

## Failure lab: see the cent go missing before you read the fix

Do not take "floats lose cents" on trust. It takes four minutes to watch it happen.

**Step 1 - the classic, in any console.**

```javascript
0.1 + 0.2;                       // 0.30000000000000004
0.1 + 0.2 === 0.3;               // false
(0.1 + 0.2).toFixed(2);          // "0.30"   <- the error is still there, just hidden
0.1 + 0.2 - 0.3;                 // 5.551115123125783e-17
```

The third line is the dangerous one. Rounding for display makes the bug invisible while leaving
it in the value, which is why this class of defect survives so long: everything on the screen
looks right.

**Step 2 - make it visible in this app.** Seed a ledger of a thousand one-cent rows:

```javascript
localStorage.setItem("js1-budget-tracker", JSON.stringify(
  Array.from({ length: 1000 }, (_, i) => ({
    id: String(i), description: "Penny", category: "Test",
    type: "income", amount: 0.01, date: "2026-09-08"
  }))
));
location.reload();
```

`#income-total` reads `$10.00`. Now compute the same sum the way the old code did, in the
console: `Array.from({length:1000}, () => 0.01).reduce((a, b) => a + b)` gives
**9.999999999999831**. Ten dollars is correct; the float sum is not; and the formatter cannot
tell you which one you have.

**Step 3 - where it stops being cosmetic.** A reconciliation check, a "did this balance to zero?"
branch, or a comparison against a bank statement compares rather than displays - and
`9.999999999999831 !== 10`. Write the one-line branch that would mis-fire.

**Step 4 - read the fix and say why it works.** `renderTransactions` (`app.js:152-155`)
accumulates `Math.round(transaction.amount * 100)` - integers - and divides by 100 once, at the
moment of display. Integers up to `Number.MAX_SAFE_INTEGER` are exact in a JavaScript number, so
the sum is exact up to about 90 trillion dollars; `parseCents` bounds a single amount well below
that (`app.js:198`). The rule to take away: **do arithmetic in the smallest unit, format last.**

**Step 5 - find the remaining seam yourself.** The stored schema is still a dollar *number*
(`app.js:93` divides by 100 on the way in). That means every value makes a float round trip
between the parser and the total. Convince yourself it is safe for two-decimal values -
`Math.round(x * 100)` recovers the integer for every amount `parseCents` admits - and then say
what would break if the product ever needed three decimals. That is the migration exercise 4
asks you to design.

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.

## All regression files in this project

- [test/money.test.cjs](../test/money.test.cjs)
