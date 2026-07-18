# Recipe Studio Codebase Guide

This app focuses on nested data: a recipe owns an array of ingredients. Arrays inside records are common in frontend forms and API payloads.

## Code Map

- `server/server.js`: recipe CRUD and ingredient validation.
- `client/src/api.js`: API calls.
- `client/src/App.jsx`: form state, comma-separated ingredient conversion, rendering.
- `client/src/styles.css`: recipe cards.

## Client Form Shape vs API Shape

The UI uses a text field:

```js
ingredientsText: ""
```

The API expects an array:

```js
const payload = {
  ...form,
  ingredients: form.ingredientsText.split(",").map((item) => item.trim()).filter(Boolean)
};
delete payload.ingredientsText;
```

This is a real-world concept: view models and API models are not always identical. Convert at the boundary.

## Server Validation

```js
if (recipe.ingredients.length === 0) {
  return res.status(400).json({ error: "Add at least one ingredient." });
}
```

Nested arrays need validation too. In a production API, validate item type, length, duplicates, and maximum count.

## Normalizing Arrays

```js
ingredients: Array.isArray(input.ingredients)
  ? input.ingredients.map((item) => String(item).trim()).filter(Boolean)
  : []
```

This protects the server from malformed JSON. Never assume a client sends the shape you expect.

## Rendering Nested Lists

```jsx
{recipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
```

Keys help React track list items. If duplicate ingredients become possible, use stable IDs instead of the ingredient text.

## Extension Practice

- Replace comma-separated ingredients with dynamic input rows.
- Add recipe steps as another nested array.
- Add tags and filter by tag.
- Add server-side duplicate ingredient removal.
- Split `App.jsx` into `RecipeForm` and `RecipeList`.

Nested forms are where clean state modeling starts to pay off.
