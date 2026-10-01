import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
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
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Recipe Studio API listening on http://localhost:${port}`);
});

function validateRecipe(req, res, next) {
  if (!isText(req.body.name,3) || !whole(req.body.cookTime,1,10080) || !whole(req.body.servings,1,1000) ||
      !Array.isArray(req.body.ingredients) || req.body.ingredients.length < 1 || req.body.ingredients.length > 100 || !req.body.ingredients.every(x => isText(x,1,500)) ||
      req.body.category !== undefined && !isText(req.body.category,1) || req.body.notes !== undefined && !isText(req.body.notes,0,10000))
    return res.status(400).json({ error: "Use whole cooking minutes/servings and 1-100 nonempty ingredient strings." });
  const recipe = normalizeRecipe(req.body);
  next();
}

// Precondition: input has passed validateRecipe (ingredients are non-empty strings).
function normalizeRecipe(input) {
  return {
    name: String(input.name || "").trim(),
    category: input.category || "Dinner",
    cookTime: Number(input.cookTime),
    servings: Number(input.servings),
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.map(item => item.trim()).filter((item,index,items) => items.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index)
      : [],
    notes: String(input.notes || "").trim()
  };
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function whole(value, min, max) { return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max; }
