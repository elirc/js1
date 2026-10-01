const STORAGE_KEY = "js1-kanban-flow";

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" }
];

const starterCards = [
  { id: crypto.randomUUID(), title: "Read the drag events", column: "todo", order: 0 },
  { id: crypto.randomUUID(), title: "Wire dragstart + drop", column: "doing", order: 0 },
  { id: crypto.randomUUID(), title: "Persist the order", column: "done", order: 0 }
];

const state = {
  cards: loadCards(),
  draggingId: null
};

const board = document.querySelector("#board");
const form = document.querySelector("#card-form");
const titleInput = document.querySelector("#card-title");
const columnInput = document.querySelector("#card-column");
const message = document.querySelector("#form-message");

form.addEventListener("submit", handleAdd);

render();

function loadCards() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterCards;
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
}

function handleAdd(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    showMessage("Give the card a title.");
    return;
  }
  const column = columnInput.value;
  state.cards.push({
    id: crypto.randomUUID(),
    title,
    column,
    order: cardsIn(column).length
  });
  saveCards();
  form.reset();
  showMessage("Card added.");
  render();
}

function renameCard(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  const next = prompt("Edit card title", card.title);
  if (next === null) return;
  const title = next.trim();
  if (!title) return;
  card.title = title;
  saveCards();
  render();
}

function deleteCard(id) {
  state.cards = state.cards.filter((card) => card.id !== id);
  saveCards();
  showMessage("Card deleted.");
  render();
}

function cardsIn(columnId) {
  return state.cards
    .filter((card) => card.column === columnId)
    .sort((a, b) => a.order - b.order);
}

// Drop the dragged card into `columnId`, positioned before `beforeId`
// (or at the end when `beforeId` is null), then renumber every column.
function moveCard(columnId, beforeId, cardId = state.draggingId) {
  const current = state.cards.find(card => card.id === cardId);
  if (!current || !COLUMNS.some(column => column.id === columnId)) return false;
  if (beforeId === cardId) return true;
  if (beforeId && !state.cards.some(card => card.id === beforeId && card.column === columnId)) return false;
  const candidate = state.cards.map(card => ({ ...card }));
  const moved = candidate.find(card => card.id === cardId);
  moved.column = columnId;
  for (const column of COLUMNS) {
    const ordered = candidate.filter(card => card.column === column.id && card.id !== cardId)
      .sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
    if (column.id === columnId) ordered.splice(beforeId ? ordered.findIndex(card => card.id === beforeId) : ordered.length, 0, moved);
    ordered.forEach((card,index) => { card.order = index; });
  }
  // A drop that changes nothing must not claim it moved anything, and must not write.
  if (JSON.stringify(candidate) === JSON.stringify(state.cards)) { showMessage("Card is already there."); return true; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); }
  catch { showMessage("Could not save the move. The board is unchanged."); return false; }
  state.cards = candidate; render(); showMessage("Card moved."); return true;
}

function moveByKeyboard(card, direction) {
  const ordered = cardsIn(card.column), index = ordered.findIndex(x => x.id === card.id);
  const before = direction < 0 ? ordered[index - 1]?.id : ordered[index + 2]?.id ?? null;
  if (direction < 0 && index === 0 || direction > 0 && index === ordered.length - 1) return;
  if (moveCard(card.column, before, card.id)) document.querySelector(`[data-id="${card.id}"] .move-column`)?.focus();
}

function render() {
  board.innerHTML = "";

  COLUMNS.forEach((column) => {
    const cards = cardsIn(column.id);

    const section = document.createElement("section");
    section.className = "column";
    section.dataset.column = column.id;

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = column.title;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = cards.length;
    header.append(title, count);

    const dropzone = document.createElement("div");
    dropzone.className = "dropzone";
    dropzone.dataset.column = column.id;

    // Allow dropping into the column itself (appends to the end).
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("over"));
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("over");
      const beforeId = event.target.closest(".card")?.dataset.id || null;
      moveCard(column.id, beforeId);
    });

    cards.forEach((card) => dropzone.append(buildCard(card)));

    if (cards.length === 0) {
      const hint = document.createElement("p");
      hint.className = "drop-hint";
      hint.textContent = "Drop cards here";
      dropzone.append(hint);
    }

    section.append(header, dropzone);
    board.append(section);
  });
}

function buildCard(card) {
  const el = document.createElement("article");
  el.className = "card";
  el.draggable = true;
  el.dataset.id = card.id;

  el.addEventListener("dragstart", () => {
    state.draggingId = card.id;
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => {
    state.draggingId = null;
    el.classList.remove("dragging");
  });

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = card.title;

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    iconButton("Edit", () => renameCard(card.id)),
    iconButton("Delete", () => deleteCard(card.id), "danger")
  );

  const move = document.createElement("select");
  move.className = "move-column"; move.setAttribute("aria-label", `Move ${card.title} to column`);
  for (const column of COLUMNS) move.add(new Option(column.title, column.id));
  move.value = card.column;
  move.addEventListener("change", () => {
    moveCard(move.value, null, card.id);
    document.querySelector(`[data-id="${card.id}"] .move-column`)?.focus();
  });
  actions.append(iconButton("Move up", () => moveByKeyboard(card,-1)), iconButton("Move down", () => moveByKeyboard(card,1)));
  el.append(title, move, actions);
  return el;
}

function iconButton(label, onClick, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `link-button ${variant}`.trim();
  button.textContent = label;
  // Stop the click from bubbling into a drag interaction.
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function showMessage(text) {
  message.textContent = text;
}
