const STORAGE_KEY = "js1-poll-studio";
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

const starterPolls = [
  {
    id: crypto.randomUUID(),
    question: "What should we build next?",
    options: [
      { id: crypto.randomUUID(), text: "Mobile app", votes: 4 },
      { id: crypto.randomUUID(), text: "Public API", votes: 7 },
      { id: crypto.randomUUID(), text: "Dark mode", votes: 2 }
    ]
  }
];

const state = {
  polls: loadPolls(),
  editingId: null,
  // draft option text values held while the form is open
  draftOptions: [newOption(), newOption()]
};

const form = document.querySelector("#poll-form");
const idInput = document.querySelector("#poll-id");
const questionInput = document.querySelector("#poll-question");
const optionRows = document.querySelector("#option-rows");
const addOptionButton = document.querySelector("#add-option");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const pollList = document.querySelector("#poll-list");
const pollCount = document.querySelector("#poll-count");
const emptyState = document.querySelector("#empty-state");

form.addEventListener("submit", handleSubmit);
cancelButton.addEventListener("click", resetForm);
addOptionButton.addEventListener("click", () => {
  if (state.draftOptions.length >= MAX_OPTIONS) {
    showMessage(`Polls can have up to ${MAX_OPTIONS} options.`);
    return;
  }
  state.draftOptions.push(newOption());
  renderOptionRows();
});

renderOptionRows();
render();

function loadPolls() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterPolls;
}

function newOption() { return { id: crypto.randomUUID(), text: "" }; }

function commitPolls(candidate) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); }
  catch { showMessage("Could not save. Your current poll and draft are unchanged."); return false; }
  state.polls = candidate;
  return true;
}

function renderOptionRows() {
  optionRows.innerHTML = "";
  state.draftOptions.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "option-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = value.text;
    input.setAttribute("aria-label", `Option ${index + 1}`);
    input.maxLength = 80;
    input.placeholder = `Option ${index + 1}`;
    input.addEventListener("input", (event) => {
      state.draftOptions[index].text = event.target.value;
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove option ${index + 1}`);
    remove.disabled = state.draftOptions.length <= MIN_OPTIONS;
    remove.addEventListener("click", () => {
      state.draftOptions.splice(index, 1);
      renderOptionRows();
    });

    row.append(input, remove);
    optionRows.append(row);
  });
}

function handleSubmit(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  const draft = state.draftOptions.map(option => ({ ...option, text: option.text.trim() }));
  if (!question || question.length > 160) return showMessage("Add a question of at most 160 characters.");
  if (draft.length < MIN_OPTIONS || draft.length > MAX_OPTIONS || draft.some(x => !x.text || x.text.length > 80))
    return showMessage("Fill every option, or remove its row. Use 2 to 6 options of at most 80 characters.");
  if (new Set(draft.map(x => x.text.toLowerCase())).size !== draft.length)
    return showMessage("Each option must have different text (ignoring letter case).");
  const existing = state.polls.find(poll => poll.id === state.editingId);
  if (state.editingId && !existing) return showMessage("This poll no longer exists.");
  const options = draft.map(option => ({ ...option, votes: existing?.options.find(x => x.id === option.id)?.votes ?? 0 }));
  const poll = { id: existing?.id ?? crypto.randomUUID(), question, options };
  const candidate = existing ? state.polls.map(x => x.id === poll.id ? poll : x) : [poll, ...state.polls];
  if (!commitPolls(candidate)) return;
  showMessage(existing ? "Poll updated." : "Poll created."); resetForm(); render();
}

function vote(pollId, optionId) {
  const candidate = state.polls.map(poll => poll.id !== pollId ? poll : {
    ...poll, options: poll.options.map(option => option.id === optionId ? { ...option, votes: option.votes + 1 } : option)
  });
  if (commitPolls(candidate)) render();
}

function resetVotes(pollId) {
  const candidate = state.polls.map(poll => poll.id !== pollId ? poll : {
    ...poll, options: poll.options.map(option => ({ ...option, votes: 0 }))
  });
  if (commitPolls(candidate)) render();
}

function editPoll(id) {
  const poll = state.polls.find(item => item.id === id); if (!poll) return;
  state.editingId = id; idInput.value = id; questionInput.value = poll.question;
  state.draftOptions = poll.options.map(({ id, text }) => ({ id, text }));
  renderOptionRows(); submitButton.textContent = "Update poll"; cancelButton.hidden = false; questionInput.focus();
}

function deletePoll(id) {
  if (!commitPolls(state.polls.filter(poll => poll.id !== id))) return;
  if (state.editingId === id) resetForm(); showMessage("Poll deleted."); render();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  state.editingId = null;
  state.draftOptions = [newOption(), newOption()];
  renderOptionRows();
  submitButton.textContent = "Create poll";
  cancelButton.hidden = true;
}

function render() {
  pollList.innerHTML = "";
  pollCount.textContent = state.polls.length;
  emptyState.hidden = state.polls.length > 0;

  state.polls.forEach((poll) => {
    const total = poll.options.reduce((sum, option) => sum + option.votes, 0);

    const card = document.createElement("article");
    card.className = "poll-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = poll.question;
    const totalTag = document.createElement("span");
    totalTag.className = "muted";
    totalTag.textContent = total === 1 ? "1 vote" : `${total} votes`;
    header.append(title, totalTag);

    const results = document.createElement("div");
    results.className = "results";
    poll.options.forEach((option) => {
      const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);

      const result = document.createElement("button");
      result.type = "button";
      result.className = "result";
      result.title = "Click to vote";
      result.addEventListener("click", () => vote(poll.id, option.id));

      const bar = document.createElement("span");
      bar.className = "bar";
      bar.style.width = `${pct}%`;

      const label = document.createElement("span");
      label.className = "result-label";
      label.textContent = option.text;

      const value = document.createElement("span");
      value.className = "result-value";
      value.textContent = `${pct}% · ${option.votes}`;

      result.append(bar, label, value);
      results.append(result);
    });

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Reset votes", "secondary", () => resetVotes(poll.id)),
      makeButton("Edit", "", () => editPoll(poll.id)),
      makeButton("Delete", "danger", () => deletePoll(poll.id))
    );

    card.append(header, results, actions);
    pollList.append(card);
  });
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
