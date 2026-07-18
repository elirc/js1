// main.js — the entry point. It wires DOM events to the store and the
// rendering helpers. Run via <script type="module"> in index.html.

import { deleteSnippet, getSnippet, listSnippets, saveSnippet } from "./store.js";
import { buildCard, copyToClipboard } from "./dom.js";

const view = { query: "", language: "All", editingId: null };

const form = document.querySelector("#snippet-form");
const idInput = document.querySelector("#snippet-id");
const titleInput = document.querySelector("#snippet-title");
const languageInput = document.querySelector("#snippet-language");
const tagsInput = document.querySelector("#snippet-tags");
const codeInput = document.querySelector("#snippet-code");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const searchInput = document.querySelector("#search-input");
const languageFilter = document.querySelector("#language-filter");
const list = document.querySelector("#snippet-list");
const count = document.querySelector("#snippet-count");
const emptyState = document.querySelector("#empty-state");

form.addEventListener("submit", handleSubmit);
cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  view.query = event.target.value;
  render();
});
languageFilter.addEventListener("change", (event) => {
  view.language = event.target.value;
  render();
});

render();

function handleSubmit(event) {
  event.preventDefault();
  if (!titleInput.value.trim() || !codeInput.value.trim()) {
    showMessage("Add a title and some code.");
    return;
  }

  saveSnippet({
    id: view.editingId,
    title: titleInput.value,
    language: languageInput.value,
    tags: tagsInput.value,
    code: codeInput.value
  });

  showMessage(view.editingId ? "Snippet updated." : "Snippet saved.");
  resetForm();
  render();
}

function startEdit(id) {
  const snippet = getSnippet(id);
  if (!snippet) return;

  view.editingId = id;
  idInput.value = snippet.id;
  titleInput.value = snippet.title;
  languageInput.value = snippet.language;
  tagsInput.value = snippet.tags.join(", ");
  codeInput.value = snippet.code;
  submitButton.textContent = "Update snippet";
  cancelButton.hidden = false;
  titleInput.focus();
}

function removeSnippet(id) {
  deleteSnippet(id);
  if (view.editingId === id) resetForm();
  showMessage("Snippet deleted.");
  render();
}

async function copySnippet(snippet, container) {
  const copied = await copyToClipboard(snippet.code);
  showMessage(copied ? `Copied "${snippet.title}".` : "Clipboard not available in this browser.");
  if (copied) {
    const button = container.querySelector("button");
    const original = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => (button.textContent = original), 1200);
  }
}

function resetForm() {
  form.reset();
  idInput.value = "";
  view.editingId = null;
  submitButton.textContent = "Save snippet";
  cancelButton.hidden = true;
}

function render() {
  const snippets = listSnippets(view);
  list.innerHTML = "";
  count.textContent = snippets.length;
  emptyState.hidden = snippets.length > 0;

  const handlers = {
    onEdit: startEdit,
    onDelete: removeSnippet,
    onCopy: copySnippet
  };

  snippets.forEach((snippet) => list.append(buildCard(snippet, handlers)));
}

function showMessage(text) {
  message.textContent = text;
}
