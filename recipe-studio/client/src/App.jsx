import { useEffect, useState } from "react";
import { createRecipe, deleteRecipe, listRecipes, updateRecipe } from "./api";
import "./styles.css";

const blankRecipe = {
  name: "",
  category: "Dinner",
  cookTime: 30,
  servings: 4,
  ingredientsText: "",
  notes: ""
};

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [form, setForm] = useState(blankRecipe);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", category: "all" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshRecipes();
  }, [filters]);

  async function refreshRecipes() {
    try {
      setRecipes(await listRecipes(filters));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveRecipe(event) {
    event.preventDefault();
    const payload = {
      ...form,
      ingredients: form.ingredientsText.split(",").map((item) => item.trim()).filter(Boolean)
    };
    delete payload.ingredientsText;

    try {
      if (editingId) {
        await updateRecipe(editingId, payload);
        setMessage("Recipe updated.");
      } else {
        await createRecipe(payload);
        setMessage("Recipe created.");
      }
      resetForm();
      await refreshRecipes();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editRecipe(recipe) {
    setEditingId(recipe.id);
    setForm({
      name: recipe.name,
      category: recipe.category,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      ingredientsText: recipe.ingredients.join(", "),
      notes: recipe.notes
    });
  }

  async function removeRecipe(id) {
    await deleteRecipe(id);
    setMessage("Recipe deleted.");
    await refreshRecipes();
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankRecipe);
  }

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Advanced Project 3</p>
        <h1>Recipe Studio</h1>
      </header>

      <section className="grid">
        <form className="panel" onSubmit={saveRecipe}>
          <label htmlFor="field-name">Name</label>
          <input id="field-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />

          <div className="field-row">
            <div>
              <label htmlFor="field-category">Category</label>
              <select id="field-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Dessert</option>
              </select>
            </div>
            <div>
              <label htmlFor="field-cook-time">Cook time</label>
              <input id="field-cook-time" type="number" value={form.cookTime} onChange={(event) => setForm({ ...form, cookTime: event.target.value })} />
            </div>
          </div>

          <label htmlFor="field-servings">Servings</label>
          <input id="field-servings" type="number" value={form.servings} onChange={(event) => setForm({ ...form, servings: event.target.value })} />

          <label htmlFor="field-ingredients-text">Ingredients</label>
          <textarea id="field-ingredients-text" rows="3" value={form.ingredientsText} onChange={(event) => setForm({ ...form, ingredientsText: event.target.value })} placeholder="rice, beans, lime" />

          <label htmlFor="field-notes">Notes</label>
          <textarea id="field-notes" rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />

          <div className="actions">
            <button>{editingId ? "Update recipe" : "Create recipe"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p role="status" className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search recipes" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
              <option value="all">All categories</option>
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
              <option>Dessert</option>
            </select>
          </div>

          <div className="recipes">
            {recipes.map((recipe) => (
              <article className="recipe" key={recipe.id}>
                <h2>{recipe.name}</h2>
                <p>{recipe.category} · {recipe.cookTime} minutes · {recipe.servings} servings</p>
                <ul>
                  {recipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
                </ul>
                <p>{recipe.notes}</p>
                <div className="actions">
                  <button type="button" onClick={() => editRecipe(recipe)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeRecipe(recipe.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
