# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** NaN cooking values could evade checks, ingredient objects were coerced into text, and repeated labels were duplicated.

**After:** Cooking minutes and servings are bounded whole numbers. Ingredients must be 1-100 nonempty bounded strings. Trimming and case-insensitive deduplication preserve first spelling. Invalid nested payloads are rejected before mutation.

## Predict this example

[" Salt ", "salt", "Water"] saves as ["Salt", "Water"]. Servings "4" becomes numeric 4 without changing id. Object ingredients, blanks, fractional servings and boolean cooking time fail.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [server/server.js](../server/server.js) near line 66. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```javascript
function validateRecipe(req, res, next) {
  if (!isText(req.body.name,3) || !whole(req.body.cookTime,1,10080) || !whole(req.body.servings,1,1000) ||
      !Array.isArray(req.body.ingredients) || req.body.ingredients.length > 100 || !req.body.ingredients.every(x => isText(x,1,500)) ||
      req.body.category !== undefined && !isText(req.body.category,1) || req.body.notes !== undefined && !isText(req.body.notes,0,10000))
    return res.status(400).json({ error: "Use whole cooking minutes/servings and 1-100 nonempty ingredient strings." });
  const recipe = normalizeRecipe(req.body);
  if (!recipe.name || recipe.name.length < 3) {
    return res.status(400).json({ error: "Recipe name must be at least 3 characters." });
  }
  if (recipe.cookTime < 1 || recipe.servings < 1) {
    return res.status(400).json({ error: "Cook time and servings must be positive." });
  }
  if (recipe.ingredients.length === 0) {
    return res.status(400).json({ error: "Add at least one ingredient." });
  }
  next();
}

```

## The new implicit contract: `normalizeRecipe` trusts its caller

Before the change `normalizeRecipe` coerced everything (`String(item)`), so it could be called with anything. Now it maps `item.trim()` over the ingredients, which means it may only be called *behind* `validateRecipe`, which has already proven every ingredient is a non-empty string. Call it directly with a bad body and you get:

```js
> normalizeRecipe({ name: "Soup", ingredients: [42] })
TypeError: item.trim is not a function
```

That is not a bug; it is a contract: validation happens once, at the boundary, and normalization assumes validated input. The cost is that the contract is invisible in the code. Two ways to make it visible: a comment above `normalizeRecipe` naming the precondition (added in the fix pass), or a type signature in a TypeScript version. Exercise 1 will make you feel this when you change the ingredient shape.

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

Checking Array.isArray is only the first step: an array can hold objects, null or blank strings. Validate each element before building the normalized recipe. String(object) hides malformed input as [object Object].

Use one representation for comparison and another for display. Salt and salt compare equal, while the first trimmed spelling stays visible. Do not infer that "1 tsp salt" equals "salt"; this app lacks a structured quantity model. Automatic scaling would require that model first. The focused regression suite demonstrates valid normalization and rejected nested values.

## Three variations to work through

- **Normal variation — first spelling wins.** `POST` with `ingredients: ["Salt", "salt", "SALT", "pepper"]`. Predict the stored list `["Salt", "pepper"]` (first spelling kept, later case variants dropped).

- **Invalid variation — a non-string ingredient.** `PUT` with `ingredients: [42]`. Predict 400 from the gate (not a `TypeError`), and the stored recipe unchanged (second test). Then `ingredients: []`: predict 400, now enforced by the gate's `length < 1`.

- **Boundary variation — 100 ingredients.** `POST` with 100 distinct strings: predict 201; with 101: predict 400. Then 100 strings that de-duplicate to 50: predict 201 with 50 stored (the bound applies to the input, the de-duplication to the output).

## Executable examples

These are the actual regression tests in [test/api.test.js](../test/api.test.js). Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

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

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
