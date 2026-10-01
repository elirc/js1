# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

New amounts require positive bounded decimal text with at most two fractional digits and real dates. Totals accumulate cents. Create, edit and delete publish only after storage succeeds, retaining the form on failure.

The key model is: Stored amounts retain the original dollar-number format. New input is parsed into bounded cents, and totals accumulate rounded cents before dollar formatting.

The worked fixture should behave as follows: Income 0.10 plus 0.20 displays $0.30; 1.01 parses to 101 cents. Reject empty, zero, negative, 1.001, Infinity, scientific notation and values above 999999999.99. A failed edit to 12.50 keeps the prior amount and the entered form value.

## Extension solutions

### Exercise 1

**Prompt:** Add field-specific money feedback.

**Approach:** Explain precision, range and required-value failures beside the associated input with an accepted example.

**Review:** You are done when a user who typed `1.005` is told *which* rule they broke, and the message still cannot be gamed. The naive implementation splits the single message at `app.js:97` into per-field ones by re-testing each condition in the handler - and immediately drifts from `parseCents`, because the handler's new regex and the parser's regex are two sources of truth for the same rule. Have `parseCents` return a reason (`{cents}` or `{error: "too-many-decimals"}`) so there is one place that decides. Show the ordinary case (a valid amount still saves) and the case that breaks a naive implementation: `"1e3"` and `""` must produce *different* messages, and neither may say "invalid number" while silently being accepted anywhere else in the app. The invariant: no message path may write.

### Exercise 2

**Prompt:** Add category totals using cents.

**Approach:** Group the same cent representation and keep overall totals independent of view filters.

**Review:** You are done when the per-category totals add up to the existing `#income-total` and `#expense-total` exactly, for a fixture that a float sum would get wrong. The naive implementation accumulates dollars (`total += t.amount`) and only rounds at the end, which is fine for two rows and wrong for two hundred - build the fixture with a hundred rows of `0.01` and one of `0.1` and compare. Accumulate `Math.round(t.amount * 100)` exactly as `renderTransactions` does at `app.js:153`, and divide once at display. Then decide the scope question consciously: are category totals whole-ledger figures like the existing totals, or do they follow `getVisibleTransactions()`? Whichever you pick, label it on screen - the existing dashboard's totals ignore the filter and nothing currently says so.

### Exercise 3

**Prompt:** Test a failed deletion.

**Approach:** Reject setItem and assert the record remains visible and persisted with useful feedback.

**Review:** You are done when the failed delete leaves **four** things unchanged and you assert all four. The naive implementation stubs `setItem` to throw, calls `deleteTransaction`, and asserts the row is still on screen - which a UI that re-renders from stale memory would also satisfy. Assert the in-memory array length, the *serialized bytes* in `localStorage` (read them before and compare strings), the fact that `resetForm()` did not run, and the "Could not save" message. The invariant is the one `commitTransactions` promises at `app.js:205-210`: `transactions = next` is unreachable unless `setItem` returned. Note the ordering that makes this testable - `deleteTransaction` (`app.js:127-132`) puts the guard *first*, before `resetForm()` and `setMessage`.

### Exercise 4

**Prompt:** Design a versioned cent-storage migration.

**Approach:** Choose rounding explicitly, preserve unconvertible raw data for review and prove migration happens once.

**Review:** This is the stretch design, so the deliverable is a written migration plan. You are done when the plan says what happens to a record it cannot interpret. The naive plan is "multiply every amount by 100 on load" - which double-converts on the second run, because nothing records that the conversion already happened. Add an explicit `schemaVersion` to the stored envelope (this is why the exercise is called *versioned*), write the conversion as a function from version N to N+1, and state the rule for a record whose `amount` is a string, negative, or `null`: quarantine it, or refuse to start? Both are defensible; silently coercing is not. Compare your plan with the much smaller thing the code actually does (`normalizeAmounts`, `app.js:71-83`): it snaps values to the cent in memory and never writes, which is not a migration at all - and say why that was enough for this change and would not be enough for yours.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/money.test.cjs](../test/money.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Number conversion and <= 0 did not reject all malformed values. Direct decimal accumulation complicated totals, and failed writes could put memory ahead of storage. I changed the implementation so that: New amounts require positive bounded decimal text with at most two fractional digits and real dates. Totals accumulate cents. Create, edit and delete publish only after storage succeeds, retaining the form on failure. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
