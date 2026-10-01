const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openApp } = require("./browser.cjs");

test("expiration is independent of low stock; today is not yet expired", async () => {
  const app = await openApp();
  try {
    app.evaluate(`localToday=()=> '2026-09-08';items=[
   {id:'a',name:'Expired full',category:'Dry',quantity:5,minimum:1,expires:'2026-09-07'},
   {id:'b',name:'Today low',category:'Dry',quantity:1,minimum:1,expires:'2026-09-08'},
   {id:'c',name:'Future full',category:'Dry',quantity:5,minimum:1,expires:'2026-09-09'}];renderItems()`);
    assert.equal(app.document.querySelector("#low-items").textContent, "1");
    app.document.querySelector("#filter").value = "Expired";
    app.event("#filter", "change");
    assert.equal(app.document.querySelectorAll("#items tr").length, 1);
    assert.match(
      app.document.querySelector(".status").textContent,
      /Stock OK.*Expired/,
    );
    app.document.querySelector("#filter").value = "Fresh";
    app.event("#filter", "change");
    assert.equal(
      app.document.querySelector(".name").textContent,
      "Future full",
    );
    assert.equal(app.evaluate("isExpired({expires:'2026-09-08'})"), false);
  } finally {
    app.close();
  }
});
test("blank quantity and impossible dates cannot be stored", async () => {
  const app = await openApp();
  try {
    const count = app.evaluate("items.length");
    app.document.querySelector("#item-name").value = "Invalid";
    app.document.querySelector("#quantity").value = "";
    app.document.querySelector("#minimum").value = "1";
    app.document.querySelector("#expires").value = "2026-09-09";
    app.event("#item-form", "submit");
    assert.equal(app.evaluate("items.length"), count);
    assert.equal(app.evaluate("isRealDate('2026-02-30')"), false);
    assert.match(app.document.querySelector("#message").textContent, /valid/);
  } finally {
    app.close();
  }
});
test("returning to the tab re-renders with the new local date", async () => {
  const app = await openApp();
  try {
    // A tab opened yesterday: the jar expires today, so on 2026-09-08 it is
    // still fine (isExpired uses a strict <, so "expires today" is not expired).
    app.evaluate(`localToday = () => '2026-09-08'; items = [
      {id:'a',name:'Yogurt',category:'Dairy',quantity:5,minimum:1,expires:'2026-09-08'}
    ]; renderItems()`);
    assert.equal(app.document.querySelector(".status").textContent, "Stock OK");

    // The clock rolls over while the tab is hidden. Nothing re-renders on its
    // own: the row on screen is now a day out of date.
    app.evaluate("localToday = () => '2026-09-09'");
    assert.equal(app.document.querySelector(".status").textContent, "Stock OK");

    // The user comes back to the tab. jsdom reports document.hidden as true by
    // default (its visibilityState starts out hidden), so the guard at
    // app.js:192 would skip the re-render; make the document visible first,
    // which is the state a real returning tab is in.
    assert.equal(app.evaluate("document.hidden"), true);
    app.evaluate(
      "Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })",
    );
    app.document.dispatchEvent(new app.w.Event("visibilitychange"));
    assert.equal(
      app.document.querySelector(".status").textContent,
      "Stock OK · Expired",
    );

    // The Expired filter now matches it, which proves the filter read the same
    // recomputed predicate and not a cached flag on the record.
    app.document.querySelector("#filter").value = "Expired";
    app.event("#filter", "change");
    assert.equal(app.document.querySelectorAll("#items tr").length, 1);

    // Nothing was written: this is a re-render, not a mutation. The stored
    // record still says what it always said.
    assert.equal(app.evaluate("items[0].expires"), "2026-09-08");
  } finally {
    app.close();
  }
});
