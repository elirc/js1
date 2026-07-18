# Recipe Studio - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** Express API in `server/server.js` (port **4103**). Data
> is the in-memory `recipes` array (fields: `id, name, category, cookTime,
> servings, ingredients[] (strings), notes`). `validateRecipe`/`normalizeRecipe`
> guard input. React client in `client/src/App.jsx` via `client/src/api.js`.

---

## Story 1: Ordered preparation steps
**As a** cook, **I want** numbered steps, **so that** I can follow the recipe.

### Acceptance criteria
- [ ] Recipes store a `steps` array of strings; the client edits them as dynamic rows (add/remove).
- [ ] Steps render as an ordered list on the card.
- [ ] Empty steps are stripped on save.

### Implementation plan
1. **`server/server.js`** - in `normalizeRecipe`, add `steps: Array.isArray(input.steps) ? input.steps.map(s=>String(s).trim()).filter(Boolean) : []`. Seed a couple of steps.
2. **`client/src/App.jsx`** - store `steps` in the form as an array; render dynamic `<input>` rows with add/remove buttons (mirror the existing ingredient handling).
3. **`client/src/App.jsx`** - render `<ol>` of steps on each recipe card.

### How to test
Add a recipe with 3 steps (one blank), save, confirm 2 steps render in order; edit to reorder/remove.

---

## Story 2: Scale servings
**As a** cook, **I want** to scale a recipe, **so that** quantities match my needs.

### Acceptance criteria
- [ ] Ingredients become structured `{ quantity, unit, item }` instead of plain strings.
- [ ] A "Scale to N servings" control multiplies displayed quantities by `N / recipe.servings`.
- [ ] Scaling is display-only (does not mutate stored data).

### Implementation plan
1. **`server/server.js`** - change `normalizeRecipe` to accept structured ingredients: map each to `{ quantity: Number(i.quantity)||0, unit: String(i.unit||"").trim(), item: String(i.item||"").trim() }`, dropping rows with no `item`. Update validation to require 1 item.
2. **`client/src/App.jsx`** - the ingredient editor becomes three inputs per row (qty / unit / item).
3. **`client/src/App.jsx`** - add a `scaleTo` number input per card (defaults to `recipe.servings`); display `quantity * (scaleTo / recipe.servings)` (rounded to 2 dp) without saving.
4. **Migration note:** seed data must use the new structured shape.

### How to test
A 4-serving recipe scaled to 8 doubles each quantity on screen; reloading shows the original stored quantities.

---

## Story 3: Favorite recipes and filter
**As a** user, **I want** to favorite recipes, **so that** I can find staples quickly.

### Acceptance criteria
- [ ] Recipes have a `favorite` flag toggled from the card.
- [ ] A "Favorites only" filter narrows the grid.

### Implementation plan
1. **`server/server.js`** - add `favorite: Boolean(input.favorite)` in `normalizeRecipe`; add `PATCH /api/recipes/:id/favorite` that flips it and returns the recipe.
2. **`client/src/api.js`** - add `toggleFavorite(id)`.
3. **`client/src/App.jsx`** - add a star button per card; add a "Favorites only" checkbox to `filters` and filter the rendered list client-side (or pass `favorite=true` to the API and filter server-side in `GET`).

### How to test
Star a recipe, enable "Favorites only", confirm only starred recipes show; unstar and confirm it disappears from the filtered view.

---

## Story 4: Tag recipes and filter by tag
**As a** user, **I want** tags, **so that** I can group recipes beyond category.

### Acceptance criteria
- [ ] Recipes store a `tags` array (comma-separated input -> array).
- [ ] Tags render as chips; clicking a chip filters by that tag.

### Implementation plan
1. **`server/server.js`** - add `tags: Array.isArray(input.tags) ? input.tags.map(t=>String(t).trim().toLowerCase()).filter(Boolean) : []` in `normalizeRecipe`. Extend the `GET` search to also match tags, and accept a `tag` query that requires `recipe.tags.includes(tag)`.
2. **`client/src/App.jsx`** - add a tags input (comma-separated) to the form; render chips; clicking a chip sets a `tag` filter and refetches.

### How to test
Tag a recipe `quick, vegetarian`, click the `quick` chip, confirm only matching recipes show.

---

## Story 5: Ingredient include/exclude search
**As a** user, **I want** to search by ingredient, **so that** I can cook with what I have.

### Acceptance criteria
- [ ] An "Has ingredient" input returns recipes containing it.
- [ ] An "Exclude ingredient" input removes recipes containing it.
- [ ] Both combine with the existing search and category filters.

### Implementation plan
1. **`server/server.js`** - in `GET /api/recipes`, read `has` and `exclude` from `req.query`. Build a lowercase list of each recipe's ingredient items (handle both string and structured shapes). Keep a recipe only if (`!has || items.some(i=>i.includes(has))`) and (`!exclude || !items.some(i=>i.includes(exclude))`).
2. **`client/src/App.jsx`** - add two inputs bound into `filters`; the existing refetch-on-filters effect handles it.

### How to test
Search has=`lemon`, exclude=`butter`, confirm only lemon recipes without butter appear; clearing the inputs restores the full list.

