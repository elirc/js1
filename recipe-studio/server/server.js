import express from "express";
import cors from "cors";

const app = express();
const port = 4103;
let recipes = [
  {
    id: crypto.randomUUID(),
    name: "Lemon Herb Pasta",
    category: "Dinner",
    cookTime: 25,
    servings: 4,
    ingredients: ["pasta", "lemon", "parsley", "olive oil"],
    notes: "Reserve pasta water for the sauce."
  }
];

app.use(cors());
app.use(express.json());

app.get("/api/recipes", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const category = String(req.query.category || "all");
  const result = recipes.filter((recipe) => {
    const haystack = `${recipe.name} ${recipe.category} ${recipe.ingredients.join(" ")}`.toLowerCase();
    return haystack.includes(search) && (category === "all" || recipe.category === category);
  });
  res.json(result);
});

app.post("/api/recipes", validateRecipe, (req, res) => {
  const recipe = { id: crypto.randomUUID(), ...normalizeRecipe(req.body) };
  recipes.unshift(recipe);
  res.status(201).json(recipe);
});

app.put("/api/recipes/:id", validateRecipe, (req, res) => {
  const existing = recipes.find((recipe) => recipe.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Recipe not found." });
  }
  const updated = { ...existing, ...normalizeRecipe(req.body) };
  recipes = recipes.map((recipe) => recipe.id === req.params.id ? updated : recipe);
  res.json(updated);
});

app.delete("/api/recipes/:id", (req, res) => {
  const before = recipes.length;
  recipes = recipes.filter((recipe) => recipe.id !== req.params.id);
  if (recipes.length === before) {
    return res.status(404).json({ error: "Recipe not found." });
  }
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Recipe Studio API listening on http://localhost:${port}`);
});

function validateRecipe(req, res, next) {
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

function normalizeRecipe(input) {
  return {
    name: String(input.name || "").trim(),
    category: input.category || "Dinner",
    cookTime: Number(input.cookTime),
    servings: Number(input.servings),
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
    notes: String(input.notes || "").trim()
  };
}
