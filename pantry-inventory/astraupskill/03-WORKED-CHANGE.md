# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** Fresh really meant above the stock threshold, so an expired item could appear fresh. Some invalid numeric values passed validation.

**After:** Rows show stock and expiration independently. Expired filtering is available, and the in-stock/nonexpired view excludes expired items. New quantities must be finite and nonnegative, dates must be real, and returning to the tab refreshes date-based status.

## Predict this example

On September 8, an item expiring September 7 with quantity five and minimum one is Stock OK and Expired. An item expiring today with quantity one and minimum one is Low stock and not expired. Only a future sufficiently stocked item matches the combined view.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [app.js](../app.js) near line 130. It is a teaching snapshot; the
linked source is authoritative if you later edit the project. Read surrounding code for callers
and setup.

**What changed here.** In
`git show 606e0e6:pantry-inventory/app.js` the filter had one
predicate and the status had one ternary:

```diff
     const isLow = item.quantity <= item.minimum;
-    const matchesFilter = activeFilter === "All" || (activeFilter === "Low" && isLow) || (activeFilter === "Fresh" && !isLow);
+    const matchesFilter = activeFilter === "All" || (activeFilter === "Low" && isLow) || (activeFilter === "Fresh" && !isLow && !isExpired(item)) || (activeFilter === "Expired" && isExpired(item));
     return matchesSearch && matchesFilter;
```

```diff
-    const statusText = item.quantity <= item.minimum ? "Low" : "Fresh";
+    const low = item.quantity <= item.minimum;
+    const expired = isExpired(item);
+    const statusText = [low ? "Low stock" : "Stock OK", ...(expired ? ["Expired"] : [])].join(" · ");
...
-    status.classList.toggle("low", statusText === "Low");
+    status.classList.toggle("low", low || expired);
```

That second hunk is the modelling lesson in three lines. "Fresh" was doing two jobs - the filter meant
"not low on stock" while the label implied "safe to eat" - so a fully stocked, three-weeks-expired jar of
something read **Fresh**. The fix does not add a third *value* to one field; it separates the
field into two independent booleans and joins them for display. A row can now say
`Stock OK · Expired`, which was previously inexpressible.

Three further hunks belong to the same change: `isExpired` and `localToday`
(`app.js:180-185`, both new), the extra validation conditions at `app.js:78-81`, and the
`visibilitychange` listener at `app.js:192`.

```javascript
function getVisibleItems() {
  return items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(searchTerm);
    const isLow = item.quantity <= item.minimum;
    const matchesFilter = activeFilter === "All" || (activeFilter === "Low" && isLow) || (activeFilter === "Fresh" && !isLow && !isExpired(item)) || (activeFilter === "Expired" && isExpired(item));
    return matchesSearch && matchesFilter;
  });
}

```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

A single status can hide independent dimensions. Compute low and expired separately and compose them for each view. Equality at the stock threshold is intentional: stock equal to minimum is already low. Equality at the date boundary has a different rule: this app treats the labeled date as valid through that day. Valid ISO labels sort chronologically, so string comparison is useful only after date validation. Reading local year, month and day avoids a UTC conversion that could shift the calendar label. This is an inventory software rule, not food-safety guidance. Visibility refresh does not schedule an exact update at midnight in a continuously visible tab. Existing malformed storage is not automatically migrated.

## Three variations to work through

Each is a concrete edit to [test/expiration.test.cjs](../test/expiration.test.cjs). Predict the
counter, the row count and the status string before running
`node --test test/expiration.test.cjs`.

**Variation 1 (normal) - make the expired item low as well.**
Change item `a` (`Expired full`) from `quantity: 5` to `quantity: 0`. Predicted result:
`#low-items` goes from **1** to **2**; the Expired filter still shows exactly **one** row; and
that row's status changes from `Stock OK · Expired` to `Low stock · Expired`, so the
`/Stock OK.*Expired/` assertion now fails and must become `/Low stock.*Expired/`. Nothing about
the expiry changed - which is the point. Then do the arithmetic the UI invites: 2 low + 1 expired
= 3, but only **2 distinct items** need attention, because item `a` is in both counts. That
overlap is exercise 2.

**Variation 2 (invalid) - an impossible expiry date, submitted through the form.**
The delivered test asserts `isRealDate('2026-02-30')` is `false` as a direct call. Do it through
the UI instead: fill `#item-name`, `#quantity`, `#minimum` and set `#expires` to `2026-02-30`,
then submit. Predicted result: **zero writes** - compare `app.evaluate("items.length")` and the
serialized `localStorage` string before and after - and `#message` matching `/valid/`. Then
remove the round-trip check from `isRealDate` (`app.js:187-190`), leaving only
`Number.isFinite(date.getTime())`, and re-run: the item **saves**, with `expires` stored as the
string `"2026-02-30"`, which then sorts and compares as a date that does not exist. Restore the
check. The lesson is the one juniors meet as "but it parsed fine": `new Date` normalizes instead
of rejecting, so validity has to mean "survived the round trip unchanged".

**Variation 3 (boundary) - the day rolls over while the tab is open.**
Seed one item expiring on `2026-09-08` with `localToday` stubbed to `2026-09-08`. Predicted
status: `Stock OK` - the comparison is a strict `<` (`app.js:185`), so expiring **today** is not
expired. Now stub `localToday` to return `2026-09-09` and **do not** re-render: the screen still
says `Stock OK`, because the status was derived once, at render time. Dispatch
`visibilitychange` (the listener is at `app.js:192`) and predict again: the status becomes
`Stock OK · Expired` and the Expired filter now matches the row - without anything being written,
because status is derived, not stored. The third delivered test does exactly this. Finally, state
the limit you just demonstrated: the listener fires on *returning* to the tab, so a tab left
visible across midnight is still stale. That is what exercise 4 designs.

## Executable examples

These are the actual regression tests in [test/expiration.test.cjs](../test/expiration.test.cjs). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```javascript
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
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
