# Snippet Vault Codebase Guide

Snippet Vault is the best vanilla project for learning code organization. It uses ES modules to separate data, DOM creation, and app wiring.

## Code Map

- `index.html`: form, filters, snippet list.
- `styles.css`: editor-like layout and snippet cards.
- `src/store.js`: data access and mutations.
- `src/dom.js`: DOM builders and clipboard helper.
- `src/main.js`: event listeners and orchestration.

## Separation of Concerns

```js
// src/store.js owns state and persistence.
export function createSnippet(input) {
  const snippet = { id: crypto.randomUUID(), ...input };
  snippets.unshift(snippet);
  save();
  return snippet;
}
```

The store should not know about buttons, CSS classes, or forms. That boundary makes the code easier to test.

## DOM Builder Pattern

```js
export function buildCard(snippet, handlers) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  title.textContent = snippet.title;
  card.append(title);
  return card;
}
```

This is safer than building a large HTML string with user-provided code snippets. Use `textContent` for user text.

## Main as Orchestrator

```js
form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSnippetFromForm();
  render();
});
```

`main.js` connects user events to store mutations and re-rendering. In larger apps, this orchestration might be a controller, page component, or feature module.

## Clipboard Boundary

```js
export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
```

Browser APIs are side effects. Keeping them in a helper makes them easier to mock or replace.

## Extension Practice

- Add favorites.
- Add import/export.
- Add tag filtering.
- Add syntax highlighting.
- Add tests for store functions without touching the DOM.

This project is a stepping stone toward modular frontend architecture.
