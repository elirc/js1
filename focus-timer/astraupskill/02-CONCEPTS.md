# Concepts explained from first principles

[Course index](README.md)

## The central idea: deadlines, delayed callbacks and one-time completion

Scheduled callbacks are opportunities to run code, not a guarantee about elapsed time. Tabs can be throttled and the event loop can be busy. The equation remaining = max(0, (deadline - now) / 1000) separates measurement from scheduling. Keep fractional seconds internally and round only at the display boundary; rounding the stored remainder on every pause would let repeated pauses add time. The mode guard is an idempotency mechanism: after the first completion leaves running, another queued callback becomes harmless. Date.now is a wall clock and can jump if the system clock changes; this implementation fixes delayed-callback drift, not every possible clock-adjustment problem. A monotonic performance clock or a persisted wall-clock deadline each has different tradeoffs. The lesson is to state the clock assumption and test the failure mode you actually promised to fix.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> The interval is a wake-up mechanism. The deadline determines remaining time. Delayed callbacks catch up, pausing preserves fractions of a second, repeated starts do not stack intervals, and late callbacks cannot log the same completion twice.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## The same guard in an HTTP handler

The single most transferable line in this project is the first line of `completeSession`:

```javascript
function completeSession() {
  if (timer.mode !== "running") return;   // app.js:125
  timer.mode = "idle";                    // app.js:126 - claim the transition immediately
  // ... only now do the work that must happen once
}
```

Read it as a *state transition claimed atomically*. The function does not ask "have I already logged this session?" - which would need a second fact to keep in sync - it asks "am I still in the state that entitles me to do this work?", and then immediately leaves that state. Anything that arrives afterwards finds the door shut.

The server version of the same bug is the double-submitted POST. A user clicks "Place order" twice, or a mobile connection retries a request whose response was lost, and you create two orders. The naive fix - "check whether an identical order exists" - is the same mistake as counting callbacks: it compares data instead of claiming a transition, and two concurrent requests can both find nothing.

```javascript
// Same shape, one layer up. The claim is a row, not a variable.
app.post("/api/orders", async (req, res) => {
  const key = req.get("Idempotency-Key");
  if (!key) return res.status(400).json({ error: "Idempotency-Key header is required." });

  const claimed = await db("idempotency_keys")
    .insert({ key, route: "POST /api/orders" })
    .onConflict("key").ignore()
    .returning("key");                       // empty array => someone else already claimed it

  if (claimed.length === 0) {
    const previous = await db("orders").where({ idempotency_key: key }).first();
    return res.status(200).json(previous);   // replay the first answer, do not create a second order
  }

  const order = await createOrder(req.body, key);
  return res.status(201).json(order);
});
```

The correspondence is exact:

| Focus timer | HTTP handler |
|---|---|
| `timer.mode === "running"` | no row yet in `idempotency_keys` |
| `timer.mode = "idle"` at `app.js:126` | the `INSERT ... ON CONFLICT DO NOTHING` that claims the key |
| a late `tick()` returning early | the second request replaying the stored response |
| one entry in `state.sessions` | one row in `orders` |
| test 1: `tick(); tick(); completeSession()` → one log | a test that POSTs the same key twice → one order, two 2xx responses |

Two differences matter. In the browser there is one thread, so "check then set" on the next two lines is genuinely atomic; on a server it is not, which is why the claim has to be a single database operation with a unique constraint behind it rather than a `SELECT` followed by an `INSERT`. And a server has to decide what the *second* caller sees - here, a replay of the first response rather than an error, because the caller may simply never have received it.

For the server-side counterpart with real code and a real transaction, do `newcodexJS/02-contact-book` (a whole CSV import committed or rolled back as one unit) and then `newcodexJS/05-recipe-manager` (an ownership check taken inside the same transaction as the write, behind a `SELECT ... FOR UPDATE`). This project is where the idea is cheapest to see; those are where it has teeth.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

The timer has mode (idle/running/paused), remaining seconds, deadline milliseconds, duration seconds and intervalId. Session records are separate persisted history. A running timer is in-memory; page reload does not resume an active run.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
