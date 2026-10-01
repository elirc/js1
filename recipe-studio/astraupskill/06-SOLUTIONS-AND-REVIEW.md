# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Check a solution the same way the course checks its own

Every solution below should survive the same request chapter 03 runs; send it after your change and compare the response to the expected observations in chapter 03:

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

## Existing implementation

Cooking minutes and servings are bounded whole numbers. Ingredients must be 1-100 nonempty bounded strings. Trimming and case-insensitive deduplication preserve first spelling. Invalid nested payloads are rejected before mutation.

The key model is: Recipes have id, name, category, cookTime, servings, ingredients[] and notes. Ingredients are free-form text, not structured quantities. Storage is in memory.

The worked fixture should behave as follows: [" Salt ", "salt", "Water"] saves as ["Salt", "Water"]. Servings "4" becomes numeric 4 without changing id. Object ingredients, blanks, fractional servings and boolean cooking time fail.

## Extension solutions

### Exercise 1

**Prompt:** Introduce quantity/unit/name fields.

**Approach:** Define numeric quantities and explicit units, then migrate free-form text deliberately.

**Review:** the object shape must be validated in `validateRecipe` (every row an object with a non-empty `name`, a finite non-negative `amount` and a bounded `unit`), the sum must happen in `normalizeRecipe` under the same first-spelling rule, and the unit mismatch must be a 400 naming the ingredient.

### Exercise 2

**Prompt:** Add a scale preview.

**Approach:** Compute display values from target/base servings without overwriting the base recipe.

**Review:** the preview must be derived at render time from `desiredServings`; the test must assert `fetch` is not called while previewing and that the stored recipe deep-equals the original until save.

### Exercise 3

**Prompt:** Explain when deduplication is wrong.

**Approach:** Salt for a sauce and a topping may be separate; model sections before collapsing them.

**Review:** the three pairs must each have an assertion that pins today's behavior, and the paragraph must say which pair you would change and how (a normalization step, a unit-aware comparison).

### Exercise 4

**Prompt:** Add ingredient reordering.

**Approach:** Move complete ingredient records if ids are introduced and verify quantities remain attached.

**Review:** the reorder endpoint must reject any list that is not a permutation of the current ingredients (compare sorted copies), must keep `normalizeRecipe` out of the path, and the test must prove a duplicate or missing entry is a 400 with the recipe unchanged.

### Exercise 7 — ownership and authorization

Reference: an actor middleware, `requireActor` on writes, `owner` stamped on `POST`, and an owner comparison before the array mutation. Extend `request()` in `test/http.js` with a headers argument.

Review: the comparison must precede `normalizeRecipe` as well as the mutation, so a foreign edit does no work at all.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/api.test.js](../test/api.test.js) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: NaN cooking values could evade checks, ingredient objects were coerced into text, and repeated labels were duplicated. I changed the implementation so that: Cooking minutes and servings are bounded whole numbers. Ingredients must be 1-100 nonempty bounded strings. Trimming and case-insensitive deduplication preserve first spelling. Invalid nested payloads are rejected before mutation. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
