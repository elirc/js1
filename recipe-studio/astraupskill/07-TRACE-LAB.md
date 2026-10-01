# Trace lab: array element validation and normalization

[Course index](README.md) · [Worked source](03-WORKED-CHANGE.md)

## Run it before you trace it

The first executable example from chapter 03, so the trace starts from a request you have actually sent:

```javascript
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { application, request } from "./http.js";
let h;
before(async () => {
  h = await application();
});
after(async () => {
  if (h) await h.close();
});
const call = (path, method = "GET", body = undefined) =>
  request(h.origin, path, method, body);
const valid = {
  name: "Astra soup",
  category: "Dinner",
  cookTime: 20,
  servings: 2,
  ingredients: [" Salt ", "salt", "Water"],
  notes: "",
};
test("ingredient normalization deduplicates case variants while preserving first spelling", async () => {
  const made = await call("/api/recipes", "POST", valid);
  assert.equal(made.status, 201);
  assert.deepEqual(made.data.ingredients, ["Salt", "Water"]);
  const edited = await call("/api/recipes/" + made.data.id, "PUT", {
    ...valid,
    servings: "4",
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.servings, 4);
  assert.equal(edited.data.id, made.data.id);
});
test("nested ingredient and number failures are rejected before mutation", async () => {
  for (const bad of [
    { ingredients: [{}] },
    { ingredients: [""] },
    { ingredients: [] },
    { servings: "bad" },
    { servings: 0.5 },
    { cookTime: true },
    { notes: [] },
  ])
    assert.equal(
      (await call("/api/recipes", "POST", { ...valid, ...bad })).status,
      400,
      JSON.stringify(bad),
    );
});
```

Watch the server log while it runs, then follow the boundaries below with that exact request in mind.

## Prepare a prediction

Open [server/server.js](../server/server.js) and [test/api.test.js](../test/api.test.js) side by side. Use the source as the authoritative implementation; this lab is a snapshot of the delivered change. Use synthetic fixtures so a deliberate failure is easy to repeat.

Start with this concrete scenario:

[" Salt ", "salt", "Water"] saves as ["Salt", "Water"]. Servings "4" becomes numeric 4 without changing id. Object ingredients, blanks, fractional servings and boolean cooking time fail.

Draw the data before the action. Label stable identity separately from position, title or other editable attributes. Write the requested value next to the old value. Now trace the request/event one boundary at a time: input, validation, computation, state change, output. Put a mark next to every side effect. A local draft can be invalid while the authoritative record remains valid; do not merge those two states in your diagram.

## Trace the real call path

### Boundary 1 — the form decides what to send

`client/src/App.jsx`: the ingredients textarea is split into an array of strings before sending; cook time and servings are number inputs.

### Boundary 2 — the request leaves the browser

`client/src/api.js`: `POST`/`PUT /api/recipes` with `{ name, category, cookTime, servings, ingredients, notes }`.

### Boundary 3 — the middleware validates, then normalizes

`server/server.js:66` `validateRecipe`: one gate for name, whole cook time and servings, 1-100 non-empty ingredient strings, optional category and notes; then `normalizeRecipe` (line 84), which trims and de-duplicates case-insensitively while keeping the first spelling.

### Boundary 4 — the handler mutates the array

`POST` unshifts; `PUT` replaces the matching element; both synchronous.

### Boundary 5 — the storage boundary is process memory

`recipes` is a module-level array; restart reseeds; nothing to roll back.

### Boundary 6 — the response tells the client what happened

201/200 with the normalized recipe (the client sees the de-duplicated list), 400 with the gate's message.

## Expected observations

| Action or input | Expected result |
|---|---|
| Salt, salt, Water | Salt, Water; first spelling retained |
| Blank ingredient | Rejected |
| Object ingredient | Whole payload rejected |
| Fractional servings | Rejected |
| Free-form ingredient text | No automatic quantity or unit conversion |

Pick one row and hand-calculate its expected result. For a count, list the ids that participate. For an amount or average, write the arithmetic before running the app. For a rejected change, name every field that should remain identical. Error wording alone does not prove that state stayed intact.

## Follow the implementation's reasoning

Checking Array.isArray is only the first step: an array can hold objects, null or blank strings. Validate each element before building the normalized recipe. String(object) hides malformed input as [object Object].

Use one representation for comparison and another for display. Salt and salt compare equal, while the first trimmed spelling stays visible. Do not infer that "1 tsp salt" equals "salt"; this app lacks a structured quantity model. Automatic scaling would require that model first. The focused regression suite demonstrates valid normalization and rejected nested values.

Pause near `validateRecipe` and inspect both types and values. A client-side TypeScript type does not validate incoming HTTP JSON. A number-like string may be acceptable for a particular field while an array with a similar coercion is not. In the browser-only apps, saved JSON and controls likewise need deliberate shape and identity handling.

After the successful path, repeat with the failure case. Identify the last operation allowed to occur before rejection. If anything writes earlier, explain how the code avoids or reverses partial state. A try/catch explains control flow; it does not by itself create a transaction. For a repeated command, determine whether the second invocation should be a no-op or another real change before looking at the result.



## Connect the trace to executable evidence

The actual regression scenarios are:

- ingredient normalization deduplicates case variants while preserving first spelling
- nested ingredient and number failures are rejected before mutation

Run the command in the course index and read one scenario from arrangement through cleanup. Distinguish seed data from records created by the test. Identify assertions about HTTP status, domain data and before/after state. A count of three is useful only when you can explain why exactly three matching records exist.

Change one meaningful fixture value without changing its shape. Predict the result before executing. Choose a boundary that exposes a naive implementation: duplicate identity, impossible date, tied sort key, repeated command or late failed write, as applicable here. Keep the test's expected answer independent of the function under test; copying the implementation's calculation can copy the same bug.

## Independent checkpoint and answer guidance

Close the worked chapter and explain the initial state, action, invariant, result and one limitation in your own words. Locate the point where the result becomes authoritative: a successful localStorage write, a synchronous memory method or a committed SQL transaction. Explain what survives a page reload and a server restart. Consult the data model in chapter 1 if those lifetimes are unclear.

If stored state and the screen disagree, inspect the storage/network result first. A correct record with stale rendering needs a different fix from a failed write. Ask a reviewer to change one input while you predict the result aloud. If your prediction is wrong, find the first guard, query or representation change where the model diverged.

Your final learning log should contain the exact input, expected output, observed output, responsible source boundary and next question. A strong answer cites the actual helper or query and a specific limit from this lesson. Finish by attempting the first domain exercise without copying its solution; the exercise is future practice, not a feature already delivered.
