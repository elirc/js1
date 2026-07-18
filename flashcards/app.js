const STORAGE_KEY = "js1-flashcards";

const starterCards = [
  { id: crypto.randomUUID(), deck: "Spanish", front: "How do you say 'hello'?", back: "Hola", known: false },
  { id: crypto.randomUUID(), deck: "Spanish", front: "How do you say 'thank you'?", back: "Gracias", known: false },
  { id: crypto.randomUUID(), deck: "JS", front: "What does Array.map return?", back: "A new array of the same length", known: false }
];

const state = {
  cards: loadCards(),
  mode: "manage", // "manage" | "study"
  deck: "All",
  editingId: null,
  // study session
  studyOrder: [],
  studyIndex: 0,
  flipped: false
};

const manageTab = document.querySelector("#manage-tab");
const studyTab = document.querySelector("#study-tab");
const manageView = document.querySelector("#manage-view");
const studyView = document.querySelector("#study-view");
const deckFilter = document.querySelector("#deck-filter");
const deckOptions = document.querySelector("#deck-options");

const form = document.querySelector("#card-form");
const idInput = document.querySelector("#card-id");
const deckInput = document.querySelector("#card-deck");
const frontInput = document.querySelector("#card-front");
const backInput = document.querySelector("#card-back");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const cardList = document.querySelector("#card-list");
const cardCount = document.querySelector("#card-count");
const manageEmpty = document.querySelector("#manage-empty");

const flashcard = document.querySelector("#flashcard");
const flashcardText = document.querySelector("#flashcard-text");
const flashcardHint = document.querySelector("#flashcard-hint");
const studyProgress = document.querySelector("#study-progress");
const studySummary = document.querySelector("#study-summary");
const flipButton = document.querySelector("#flip-button");
const againButton = document.querySelector("#again-button");
const knownButton = document.querySelector("#known-button");
const shuffleButton = document.querySelector("#shuffle-button");

manageTab.addEventListener("click", () => setMode("manage"));
studyTab.addEventListener("click", () => setMode("study"));
deckFilter.addEventListener("change", (event) => {
  state.deck = event.target.value;
  render();
});

form.addEventListener("submit", handleSubmit);
cancelButton.addEventListener("click", resetForm);

flashcard.addEventListener("click", flip);
flashcard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    flip();
  }
});
flipButton.addEventListener("click", flip);
againButton.addEventListener("click", () => grade(false));
knownButton.addEventListener("click", () => grade(true));
shuffleButton.addEventListener("click", () => startStudy(true));

render();

function loadCards() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterCards;
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
}

function decks() {
  return [...new Set(state.cards.map((card) => card.deck))].sort();
}

function visibleCards() {
  return state.cards.filter((card) => state.deck === "All" || card.deck === state.deck);
}

function setMode(mode) {
  state.mode = mode;
  manageTab.classList.toggle("active", mode === "manage");
  studyTab.classList.toggle("active", mode === "study");
  manageView.hidden = mode !== "manage";
  studyView.hidden = mode !== "study";
  if (mode === "study") startStudy(false);
}

function handleSubmit(event) {
  event.preventDefault();
  const deck = deckInput.value.trim();
  const front = frontInput.value.trim();
  const back = backInput.value.trim();

  if (!deck || !front || !back) {
    showMessage("Fill in deck, front, and back.");
    return;
  }

  if (state.editingId) {
    state.cards = state.cards.map((card) =>
      card.id === state.editingId ? { ...card, deck, front, back } : card
    );
    showMessage("Card updated.");
  } else {
    state.cards.unshift({ id: crypto.randomUUID(), deck, front, back, known: false });
    showMessage("Card added.");
  }

  saveCards();
  resetForm();
  render();
}

function editCard(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;

  state.editingId = id;
  idInput.value = card.id;
  deckInput.value = card.deck;
  frontInput.value = card.front;
  backInput.value = card.back;
  submitButton.textContent = "Update card";
  cancelButton.hidden = false;
  frontInput.focus();
}

function deleteCard(id) {
  state.cards = state.cards.filter((card) => card.id !== id);
  saveCards();
  if (state.editingId === id) resetForm();
  showMessage("Card deleted.");
  render();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  state.editingId = null;
  submitButton.textContent = "Add card";
  cancelButton.hidden = true;
}

function render() {
  renderDeckControls();
  if (state.mode === "manage") {
    renderManage();
  } else {
    renderStudy();
  }
}

function renderDeckControls() {
  const available = decks();

  const previousFilter = state.deck;
  deckFilter.innerHTML = "";
  deckFilter.append(new Option("All decks", "All"));
  available.forEach((deck) => deckFilter.append(new Option(deck, deck)));
  if (previousFilter !== "All" && !available.includes(previousFilter)) {
    state.deck = "All";
  }
  deckFilter.value = state.deck;

  deckOptions.innerHTML = "";
  available.forEach((deck) => deckOptions.append(new Option(deck)));
}

function renderManage() {
  const cards = visibleCards();
  cardList.innerHTML = "";
  cardCount.textContent = cards.length;
  manageEmpty.hidden = cards.length > 0;

  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = "manage-card";

    const body = document.createElement("div");
    const deckTag = document.createElement("span");
    deckTag.className = "deck-tag";
    deckTag.textContent = card.deck;
    const front = document.createElement("p");
    front.className = "mc-front";
    front.textContent = card.front;
    const back = document.createElement("p");
    back.className = "mc-back muted";
    back.textContent = card.back;
    body.append(deckTag, front, back);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Edit", "secondary", () => editCard(card.id)),
      makeButton("Delete", "danger", () => deleteCard(card.id))
    );

    item.append(body, actions);
    cardList.append(item);
  });
}

function startStudy(shuffle) {
  const cards = visibleCards();
  state.studyOrder = cards.map((card) => card.id);
  if (shuffle) shuffleArray(state.studyOrder);
  state.studyIndex = 0;
  state.flipped = false;
  renderStudy();
}

function currentStudyCard() {
  const id = state.studyOrder[state.studyIndex];
  return state.cards.find((card) => card.id === id);
}

function flip() {
  if (!currentStudyCard()) return;
  state.flipped = !state.flipped;
  renderStudy();
}

function grade(known) {
  const card = currentStudyCard();
  if (!card) return;
  card.known = known;
  saveCards();
  if (state.studyIndex < state.studyOrder.length - 1) {
    state.studyIndex += 1;
    state.flipped = false;
  }
  renderStudy();
}

function renderStudy() {
  const total = state.studyOrder.length;
  const card = currentStudyCard();
  const controlsDisabled = !card;

  flipButton.disabled = controlsDisabled;
  againButton.disabled = controlsDisabled;
  knownButton.disabled = controlsDisabled;

  if (!card) {
    studyProgress.textContent = "Card 0 of 0";
    flashcardText.textContent = "No cards in this deck. Add some in Manage.";
    flashcardHint.textContent = "";
    flashcard.classList.remove("flipped");
    studySummary.textContent = "";
    return;
  }

  studyProgress.textContent = `Card ${state.studyIndex + 1} of ${total}`;
  flashcardText.textContent = state.flipped ? card.back : card.front;
  flashcardHint.textContent = state.flipped ? "Answer — grade yourself" : "Click to reveal the answer";
  flashcard.classList.toggle("flipped", state.flipped);

  const knownCount = state.studyOrder.filter((id) => {
    const c = state.cards.find((item) => item.id === id);
    return c && c.known;
  }).length;
  studySummary.textContent = `${knownCount}/${total} marked "got it"`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function makeButton(label, variant, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  if (variant) button.className = variant;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function showMessage(text) {
  message.textContent = text;
}
