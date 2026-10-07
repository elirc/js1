# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Number conversion and <= 0 did not reject all malformed values. Direct decimal accumulation complicated totals, and failed writes could put memory ahead of storage.

**After:** New amounts require positive bounded decimal text with at most two fractional digits and real dates. Totals accumulate cents. Create, edit and delete publish only after storage succeeds, retaining the form on failure.

## Predict this example

Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 193. It is a teaching snapshot; the
linked source is authoritative if you later edit the project. Read surrounding code for callers
and setup.

**This whole function is new**, and so is every line that calls it.
`git show 606e0e6:budget-tracker/app.js` had no parser at all -
it read the amount like this:

```diff
-    amount: Number(amountInput.value),
+    amount: parseCents(amountInput.value) / 100,
```

and validated it like this:

```diff
-  if (!transaction.description || !transaction.category || !transaction.date || transaction.amount <= 0) {
+  if (!transaction.description || !transaction.category || !isRealDate(transaction.date) || !Number.isFinite(transaction.amount) || !["income", "expense"].includes(transaction.type)) {
```

Before you read the parser, work out what the old two lines did with each of these:
`""` (`Number("")` is **0**, so `amount <= 0` caught it - by accident, with a message about a
positive amount rather than a missing one), `"1e3"` (**1000**, accepted silently),
`"Infinity"` (accepted, and then `JSON.stringify` turns it into `null` on the way to storage),
`"1.001"` (accepted, stored with three decimals, displayed rounded - the legacy records that
`normalizeAmounts` now has to clean up came from exactly this).

Two other hunks belong to the same change and are worth reading beside it: `commitTransactions`
(`app.js:205-210`), which is new, and the totals line in `renderTransactions` (`app.js:153`),
which changed from summing dollars to summing `Math.round(amount * 100)`.

```javascript
function parseCents(text) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return NaN;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 99999999999 ? cents : NaN;
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Number inputs supply text. Define its grammar before conversion: Number accepts forms that do not belong in this currency workflow. Split whole and fractional text, right-pad the fraction and construct integer minor units. Do not multiply arbitrary fractional input and assume an exact result. Existing saved dollars remain compatible; each total contribution is rounded to cents first. This is not a versioned migration or arbitrary-precision ledger. Extremely large collections can exceed safe aggregate limits, and legacy malformed storage is not automatically repaired. Committing state is a separate boundary: serialize the full candidate, write it, then publish it. Stable ids distinguish an edit from accidental insertion.

## Three variations to work through

Each is a concrete edit to [test/money.test.cjs](../test/money.test.cjs). Predict the exact
string the DOM will contain - not "about thirty cents" - then run
`node --test test/money.test.cjs`.

**Variation 1 (normal) - three rows of 0.1 instead of two.**
Add a third `income` row of `0.1` to the second test's fixture. Predicted result:
`#income-total` reads **`$0.40`**. Now compute it the old way in a console:
`0.1 + 0.2 + 0.1` is `0.4000000000000001`, and `Intl.NumberFormat` happens to display that as
`$0.40` anyway - so this variation **passes either way**, which is exactly why it is the first
one. Find a fixture where the two disagree: 1000 rows of `0.01` summed as floats gives
`9.999999999999831`, which formats as `$10.00`; but `0.1 + 0.2 - 0.3` is `5.55e-17`, which
formats as `$0.00` and is *not* zero, so a `total === 0` branch would take the wrong path.
Write down the general rule you just demonstrated: float error usually hides behind rounding, and
appears the moment you compare instead of display.

**Variation 2 (invalid) - the seven rejected strings, with writes counted.**
The first test already asserts `parseCents` returns `NaN` for `""`, `"0"`, `"-1"`, `"1.001"`,
`"Infinity"`, `"1e3"` and `"1000000000"`. Extend it: for each, type the string into `#amount`
with a valid description, category and date, submit, and assert **zero** writes - compare
`localStorage.getItem("js1-budget-tracker")` as a string before and after. Predicted result:
seven rejections, seven identical byte strings, one message each. Then the instructive part:
replace `parseCents(amountInput.value) / 100` with `Number(amountInput.value)` and re-run. Five
of the seven are now **accepted** (`""` → 0, `"1e3"` → 1000, `"Infinity"` → Infinity,
`"1.001"` → 1.001, `"1000000000"` → 1e9); only `"-1"` and `"0"` are still caught, by the old
`amount <= 0` check. Error text alone would not have told you this; the byte comparison does.

**Variation 3 (boundary) - fail the write on the *second* transaction, then retry.**
The delivered test stubs `Storage.prototype.setItem` to throw for every call. Use a counter that
succeeds once and throws on the second. Add one transaction (succeeds), then edit it (fails).
Predicted result: `transactions[0]` still holds the first values, the stored bytes still hold
them too, `#amount` still contains what you typed (because `resetForm()` sits *after* the guard
at `app.js:105`), `#message` matches `/Could not save/`, and `editingId` is still set - so
pressing Save again after restoring `setItem` completes the edit with no retyping. That last
point is the difference between "we showed an error" and "we let the user recover": check it
explicitly, because nothing in the code makes it obvious and a later refactor that moves
`resetForm()` above the guard would silently destroy it.

## Executable examples

These are the actual regression tests in [test/money.test.cjs](../test/money.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");

test("decimal text is converted to bounded integer cents without permissive coercion", async () => {
  const app = await openApp();
  try {
    for (const [input, expected] of [
      ["0.10", 10],
      ["0.20", 20],
      ["1.01", 101],
      ["999999999.99", 99999999999],
    ])
      assert.equal(
        app.evaluate(`parseCents(${JSON.stringify(input)})`),
        expected,
      );
    for (const input of [
      "",
      "0",
      "-1",
      "1.001",
      "Infinity",
      "1e3",
      "1000000000",
    ])
      assert.ok(
        Number.isNaN(app.evaluate(`parseCents(${JSON.stringify(input)})`)),
        input,
      );
    assert.equal(app.evaluate("isRealDate('2026-02-30')"), false);
  } finally {
    app.close();
  }
});
test("whole-ledger totals are exact for tenths and storage failure keeps the old record and editor", async () => {
  const rows = [
    {
      id: "a",
      description: "First",
      category: "Work",
      type: "income",
      amount: 0.1,
      date: "2026-09-08",
    },
    {
      id: "b",
      description: "Second",
      category: "Work",
      type: "income",
      amount: 0.2,
      date: "2026-09-08",
    },
  ];
  const app = await openApp({ "js1-budget-tracker": JSON.stringify(rows) });
  try {
    assert.equal(
      app.document.querySelector("#income-total").textContent,
      "$0.30",
    );
    app.evaluate("editTransaction('a')");
    app.document.querySelector("#amount").value = "12.50";
    app.evaluate(
      'Storage.prototype.setItem = () => { throw new Error("quota"); }',
    );
    app.event("#transaction-form", "submit");
    assert.equal(app.evaluate("transactions[0].amount"), 0.1);
    assert.equal(app.document.querySelector("#amount").value, "12.50");
    assert.match(
      app.document.querySelector("#message").textContent,
      /Could not save/,
    );
  } finally {
    app.close();
  }
});
test("legacy records with more than two decimals are snapped to the cent on load", async () => {
  // Written by an earlier build that did not bound the amount. 0.105 is the
  // interesting one: it is exactly the value where the row and the total could
  // disagree, because formatCurrency rounds for display while the total rounds
  // independently in renderTransactions.
  const legacy = [
    { id: "a", description: "Odd", category: "Work", type: "income", amount: 0.105, date: "2026-09-08" },
    { id: "b", description: "Third", category: "Work", type: "income", amount: 0.005, date: "2026-09-08" },
  ];
  const app = await openApp({ "js1-budget-tracker": JSON.stringify(legacy) });
  try {
    // In memory the amounts are now exact cents. Compare as JSON: app.evaluate
    // returns objects from the jsdom realm, whose Array.prototype is not this
    // realm's, so assert.deepEqual on them fails on the prototype check.
    assert.equal(
      app.evaluate("JSON.stringify(transactions.map((t) => t.amount))"),
      JSON.stringify([0.11, 0.01]),
    );

    // The row and the ledger agree, which is the whole point.
    const rows = [...app.document.querySelectorAll(".amount")].map((el) => el.textContent);
    assert.deepEqual(rows, ["+$0.11", "+$0.01"]);
    assert.equal(app.document.querySelector("#income-total").textContent, "$0.12");

    // Nothing was written on load: a read must never be able to fail a write.
    assert.deepEqual(
      JSON.parse(app.w.localStorage.getItem("js1-budget-tracker")).map((t) => t.amount),
      [0.105, 0.005],
    );

    // The normalized value reaches storage on the next successful commit.
    app.evaluate("commitTransactions(transactions)");
    assert.deepEqual(
      JSON.parse(app.w.localStorage.getItem("js1-budget-tracker")).map((t) => t.amount),
      [0.11, 0.01],
    );
  } finally {
    app.close();
  }
});

test("a stored zero amount is readable but cannot be re-saved, by design", async () => {
  // parseCents rejects "0" (app.js:175), and the editor reuses the same parser,
  // so a zero-amount record - which only legacy data or a hand edit can create -
  // is visible and deletable but not editable. This test pins that decision so
  // that changing it has to be deliberate; 02-CONCEPTS.md argues the tradeoff.
  const rows = [
    { id: "z", description: "Zero", category: "Work", type: "income", amount: 0, date: "2026-09-08" },
  ];
  const app = await openApp({ "js1-budget-tracker": JSON.stringify(rows) });
  try {
    assert.equal(app.document.querySelector("#income-total").textContent, "$0.00");

    app.evaluate("editTransaction('z')");
    assert.equal(app.document.querySelector("#amount").value, "0");
    app.event("#transaction-form", "submit");

    assert.match(app.document.querySelector("#message").textContent, /positive amount/);
    assert.equal(app.evaluate("transactions.length"), 1);
    assert.equal(app.evaluate("transactions[0].amount"), 0);

    // Deleting it works, so the record is not stranded.
    app.evaluate("deleteTransaction('z')");
    assert.equal(app.evaluate("transactions.length"), 0);
  } finally {
    app.close();
  }
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
