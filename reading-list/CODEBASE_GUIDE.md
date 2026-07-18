# Reading List Codebase Guide

This app is a clean example of CRUD plus sorting. Sorting seems small, but it forces you to think about whether you mutate source data or derive a view.

## Code Map

- `index.html`: book form, search box, sort dropdown, book grid.
- `styles.css`: cards, tags, responsive layout.
- `app.js`: form state, book CRUD, sorting, search, persistence.

## Domain Model

```js
{
  id: crypto.randomUUID(),
  title: "Refactoring",
  author: "Martin Fowler",
  status: "Want to Read",
  rating: "0",
  notes: "Compare examples with current projects."
}
```

`rating` is stored as a string because it comes from a `<select>`. The render path converts it when needed.

## Sort Without Mutating Source

```js
return [...books]
  .filter((book) => {
    const searchable = `${book.title} ${book.author} ${book.status} ${book.notes}`.toLowerCase();
    return searchable.includes(searchTerm);
  })
  .sort((a, b) => {
    if (sortMode === "rating") {
      return Number(b.rating) - Number(a.rating);
    }
    return a[sortMode].localeCompare(b[sortMode]);
  });
```

The `[...books]` copy is important. It prevents `sort()` from mutating the original array. Production bugs often come from accidental mutation.

## Display Fallbacks

```js
card.querySelector(".rating").textContent = Number(book.rating) ? `${book.rating} / 5` : "Not rated";
card.querySelector(".notes").textContent = book.notes || "No notes yet.";
```

Good UIs handle missing optional fields. The data can be sparse; the interface should still feel intentional.

## Edit Mode

```js
editingId = id;
idInput.value = book.id;
titleInput.value = book.title;
saveButton.textContent = "Update book";
```

The same form serves create and update. This pattern appears everywhere, from admin panels to internal tooling.

## Extension Practice

- Add a genre filter.
- Add a completion date for finished books.
- Add a "clear rating" action.
- Extract sort comparators into named functions.
- Add tests for `getVisibleBooks`.

When you add sorting, document whether it mutates or returns a new list.
