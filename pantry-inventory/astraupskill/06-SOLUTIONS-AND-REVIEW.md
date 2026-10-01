# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same check chapter 03 runs; run it after your change and compare the result to the expected observations in chapter 03:

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

## Existing implementation

Rows show stock and expiration independently. Expired filtering is available, and the in-stock/nonexpired view excludes expired items. New quantities must be finite and nonnegative, dates must be real, and returning to the tab refreshes date-based status.

The key model is: Quantity, minimum and expiration are separate fields. Low means quantity <= minimum. Expired means the YYYY-MM-DD label is earlier than local today.

The worked fixture should behave as follows: On September 8, an item expiring September 7 with quantity five and minimum one is Stock OK and Expired. An item expiring today with quantity one and minimum one is Low stock and not expired. Only a future sufficiently stocked item matches the combined view.

## Extension solutions

### Exercise 1

**Prompt:** Add an expiring-within-seven-days view.

**Approach:** Choose inclusive boundaries and build them with calendar addition; test today and the seventh day.

**Review:** You are done when "expiring within seven days" is a third independent predicate, not a third value of a status field. The naive implementation extends the status string into `"Low" | "Fresh" | "Expiring" | "Expired"` and immediately loses the ability to say "Low stock · Expiring soon" - which is the exact mistake this whole lesson exists to undo (`backups/16/app.js` used a single ternary). Add `isExpiringSoon(item, today)` beside `isExpired` (`app.js:185`) and compose it in the filter at `app.js:134`. Two edge cases to decide and write down: is an item expiring *today* "expiring soon" or already handled by the expired rule, and is an *already expired* item also "expiring soon"? Prove your choice with a fixture at day 0, day 7 and day 8 - and use date arithmetic that survives a month boundary (add days to a `Date`, do not add 7 to the day-of-month substring).

### Exercise 2

**Prompt:** Add an expired count beside low stock.

**Approach:** Count each predicate independently; an item may contribute to both.

**Review:** You are done when the two counters are correct *and* the UI does not invite the reader to add them. The naive implementation prints "3 low, 2 expired" beside each other, and the user concludes five items need attention when the real number might be three. Compute all three: low, expired, and the union. Note that both existing counters are whole-inventory numbers - `renderItems` computes them from `items`, not from `visibleItems` (`app.js:143-144`) - so filtering to "Expired" does not change them; keep that consistent and say so in the label. The invariant: counters read the same predicates as the rows, so a row shown as "Expired" is always inside the expired count. Assert that in the test rather than hard-coding two numbers.

### Exercise 3

**Prompt:** Test leap-day and midnight boundaries.

**Approach:** Use fixed local dates around February 29 and avoid toISOString when deriving expected local labels.

**Review:** You are done when the test pins behaviour that does not depend on the machine's clock or timezone. The naive implementation calls `isExpired({expires})` with no second argument and passes on the developer's laptop in February. Every one of `isExpired` (`app.js:185`) and `bestStreak`-style helpers takes `today` as a parameter precisely so a test can supply it - use it. Cover: `2024-02-29` as an expiry with `today = '2024-03-01'` (expired) and `today = '2024-02-29'` (not expired, because the comparison is strict `<`); `2026-02-30` rejected by `isRealDate` (`app.js:187-190`) so it can never be stored in the first place; and the string comparison itself - confirm `'2026-09-09' < '2026-09-10'` and then explain why `'2026-9-9'` would break it, which is why the shape regex runs first. Also test `localToday` indirectly by stubbing it, never by changing the system clock.

### Exercise 4

**Prompt:** Schedule a local-midnight refresh.

**Approach:** Compute next local midnight with calendar setters, clear/reschedule the timer and avoid a fixed 24-hour assumption.

**Review:** This is the stretch design; the deliverable is a note plus a test plan. You are done when the note explains why `setInterval(renderItems, 24 * 60 * 60 * 1000)` is wrong in three separate ways: a DST day is 23 or 25 hours, browsers throttle timers in background tabs, and a sleeping laptop does not fire them at all. Specify instead: compute the milliseconds to the next local midnight from the clock each time (build tomorrow's local midnight with `new Date(y, m, d + 1)`), use `setTimeout`, re-arm inside the callback so each wait is recomputed, and keep the existing `visibilitychange` listener (`app.js:192`) as the backstop for the sleep case. Name the two new failure modes: a full `renderItems()` replaces every row, so focus and any in-progress edit are lost at midnight; and a module-scope timer is never cleared, which matters the moment this file becomes a component. Write the test as "stub `localToday`, fire the trigger, assert the row's status changed" - the shape the delivered suite now uses for `visibilitychange`.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/expiration.test.cjs](../test/expiration.test.cjs) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: Fresh really meant above the stock threshold, so an expired item could appear fresh. Some invalid numeric values passed validation. I changed the implementation so that: Rows show stock and expiration independently. Expired filtering is available, and the in-stock/nonexpired view excludes expired items. New quantities must be finite and nonnegative, dates must be real, and returning to the tab refreshes date-based status. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
