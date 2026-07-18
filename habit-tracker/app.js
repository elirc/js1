const STORAGE_KEY = "js1-habit-tracker";
const WEEK_LENGTH = 7;

const starterHabits = [
  {
    id: crypto.randomUUID(),
    name: "Read 20 pages",
    color: "teal",
    history: seedHistory([0, 1, 2, 4])
  },
  {
    id: crypto.randomUUID(),
    name: "Stretch",
    color: "indigo",
    history: seedHistory([0, 1])
  }
];

const state = {
  habits: loadHabits(),
  editingId: null
};

const form = document.querySelector("#habit-form");
const idInput = document.querySelector("#habit-id");
const nameInput = document.querySelector("#habit-name");
const colorInput = document.querySelector("#habit-color");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const habitList = document.querySelector("#habit-list");
const habitCount = document.querySelector("#habit-count");
const emptyState = document.querySelector("#empty-state");
const overallSummary = document.querySelector("#overall-summary");

form.addEventListener("submit", handleSubmit);
cancelButton.addEventListener("click", resetForm);

render();

function loadHabits() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterHabits;
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.habits));
}

function handleSubmit(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  if (!name) {
    showMessage("Give the habit a name.");
    return;
  }

  if (state.editingId) {
    state.habits = state.habits.map((habit) =>
      habit.id === state.editingId ? { ...habit, name, color: colorInput.value } : habit
    );
    showMessage("Habit updated.");
  } else {
    state.habits.push({
      id: crypto.randomUUID(),
      name,
      color: colorInput.value,
      history: {}
    });
    showMessage("Habit added.");
  }

  saveHabits();
  resetForm();
  render();
}

function toggleDay(habitId, isoDay) {
  state.habits = state.habits.map((habit) => {
    if (habit.id !== habitId) return habit;
    const history = { ...habit.history };
    if (history[isoDay]) {
      delete history[isoDay];
    } else {
      history[isoDay] = true;
    }
    return { ...habit, history };
  });
  saveHabits();
  render();
}

function editHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  state.editingId = id;
  idInput.value = habit.id;
  nameInput.value = habit.name;
  colorInput.value = habit.color;
  submitButton.textContent = "Update habit";
  cancelButton.hidden = false;
  nameInput.focus();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((habit) => habit.id !== id);
  saveHabits();
  resetForm();
  showMessage("Habit removed.");
  render();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  state.editingId = null;
  submitButton.textContent = "Add habit";
  cancelButton.hidden = true;
}

function render() {
  habitList.innerHTML = "";
  habitCount.textContent = state.habits.length;
  emptyState.hidden = state.habits.length > 0;

  const week = lastNDays(WEEK_LENGTH);

  state.habits.forEach((habit) => {
    const row = document.createElement("article");
    row.className = `habit-row accent-${habit.color}`;

    const header = document.createElement("div");
    header.className = "habit-header";
    const title = document.createElement("h3");
    title.textContent = habit.name;
    const streak = document.createElement("span");
    streak.className = "streak-badge";
    const streakValue = currentStreak(habit);
    streak.textContent = streakValue === 1 ? "1 day streak" : `${streakValue} day streak`;
    header.append(title, streak);

    const grid = document.createElement("div");
    grid.className = "day-grid";
    week.forEach((day) => {
      const iso = isoDate(day);
      const done = Boolean(habit.history[iso]);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `day-cell ${done ? "done" : ""}`;
      cell.setAttribute("aria-pressed", String(done));
      cell.innerHTML = `<span class="dow">${weekday(day)}</span><span class="dom">${day.getDate()}</span>`;
      cell.addEventListener("click", () => toggleDay(habit.id, iso));
      grid.append(cell);
    });

    const footer = document.createElement("div");
    footer.className = "habit-footer";
    const done = week.filter((day) => habit.history[isoDate(day)]).length;
    const pct = Math.round((done / WEEK_LENGTH) * 100);
    const progress = document.createElement("p");
    progress.className = "muted";
    progress.textContent = `${done}/${WEEK_LENGTH} days this week (${pct}%)`;
    const controls = document.createElement("div");
    controls.className = "card-actions";
    const editBtn = button("Edit", "", () => editHabit(habit.id));
    const delBtn = button("Delete", "danger", () => deleteHabit(habit.id));
    controls.append(editBtn, delBtn);
    footer.append(progress, controls);

    row.append(header, grid, footer);
    habitList.append(row);
  });

  renderSummary(week);
}

function renderSummary(week) {
  if (state.habits.length === 0) {
    overallSummary.textContent = "No habits yet.";
    return;
  }
  const possible = state.habits.length * WEEK_LENGTH;
  const completed = state.habits.reduce(
    (total, habit) => total + week.filter((day) => habit.history[isoDate(day)]).length,
    0
  );
  const pct = Math.round((completed / possible) * 100);
  overallSummary.textContent = `${completed}/${possible} check-ins completed (${pct}%).`;
}

function currentStreak(habit) {
  let streak = 0;
  const cursor = startOfToday();
  while (habit.history[isoDate(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function button(label, variant, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  if (variant) el.className = variant;
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function lastNDays(count) {
  const base = startOfToday();
  const days = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(base);
    day.setDate(base.getDate() - offset);
    days.push(day);
  }
  return days;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekday(date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function seedHistory(offsets) {
  const base = startOfToday();
  const history = {};
  offsets.forEach((offset) => {
    const day = new Date(base);
    day.setDate(base.getDate() - offset);
    history[isoDate(day)] = true;
  });
  return history;
}

function showMessage(text) {
  message.textContent = text;
}
