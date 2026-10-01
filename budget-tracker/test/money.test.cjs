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
