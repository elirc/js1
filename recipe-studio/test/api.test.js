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
