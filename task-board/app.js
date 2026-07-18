const STORAGE_KEY = "js1-task-board";

const starterTasks = [
  {
    id: crypto.randomUUID(),
    title: "Sketch the data model",
    priority: "High",
    status: "Backlog",
    due: "2026-06-20",
    notes: "Identify fields before writing render code."
  },
  {
    id: crypto.randomUUID(),
    title: "Refactor repeated DOM creation",
    priority: "Medium",
    status: "In Progress",
    due: "2026-06-22",
    notes: "Keep the first version simple, then extract helpers."
  }
];

const state = {
  tasks: loadTasks(),
  query: "",
  status: "All",
  editingId: null
};

const form = document.querySelector("#task-form");
const idInput = document.querySelector("#task-id");
const titleInput = document.querySelector("#task-title");
const priorityInput = document.querySelector("#task-priority");
const statusInput = document.querySelector("#task-status");
const dueInput = document.querySelector("#task-due");
const notesInput = document.querySelector("#task-notes");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const emptyState = document.querySelector("#empty-state");

form.addEventListener("submit", handleSubmit);
cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});
statusFilter.addEventListener("change", (event) => {
  state.status = event.target.value;
  render();
});

render();

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterTasks;
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function handleSubmit(event) {
  event.preventDefault();

  const task = {
    id: idInput.value || crypto.randomUUID(),
    title: titleInput.value.trim(),
    priority: priorityInput.value,
    status: statusInput.value,
    due: dueInput.value,
    notes: notesInput.value.trim()
  };

  if (!task.title || !task.due) {
    showMessage("Add a task name and due date.");
    return;
  }

  if (state.editingId) {
    state.tasks = state.tasks.map((item) => item.id === state.editingId ? task : item);
    showMessage("Task updated.");
  } else {
    state.tasks.unshift(task);
    showMessage("Task added.");
  }

  saveTasks();
  resetForm();
  render();
}

function editTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  state.editingId = id;
  idInput.value = task.id;
  titleInput.value = task.title;
  priorityInput.value = task.priority;
  statusInput.value = task.status;
  dueInput.value = task.due;
  notesInput.value = task.notes;
  submitButton.textContent = "Update task";
  cancelButton.hidden = false;
  titleInput.focus();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks();
  resetForm();
  showMessage("Task deleted.");
  render();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  state.editingId = null;
  submitButton.textContent = "Add task";
  cancelButton.hidden = true;
}

function getVisibleTasks() {
  return state.tasks.filter((task) => {
    const matchesStatus = state.status === "All" || task.status === state.status;
    const searchable = `${task.title} ${task.priority} ${task.status} ${task.notes}`.toLowerCase();
    return matchesStatus && searchable.includes(state.query);
  });
}

function render() {
  const tasks = getVisibleTasks();
  taskList.innerHTML = "";
  taskCount.textContent = tasks.length;
  emptyState.hidden = tasks.length > 0;

  tasks.forEach((task) => {
    const card = document.createElement("article");
    card.className = "task-card";
    card.innerHTML = `
      <header>
        <h3 class="task-title"></h3>
        <time class="muted"></time>
      </header>
      <div class="pill-row">
        <span class="pill ${task.priority.toLowerCase()}"></span>
        <span class="pill"></span>
      </div>
      <p class="notes"></p>
      <div class="card-actions">
        <button type="button" data-action="edit">Edit</button>
        <button type="button" class="danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector(".task-title").textContent = task.title;
    card.querySelector("time").textContent = `Due ${formatDate(task.due)}`;
    const pills = card.querySelectorAll(".pill");
    pills[0].textContent = task.priority;
    pills[1].textContent = task.status;
    card.querySelector(".notes").textContent = task.notes || "No notes yet.";
    card.querySelector("[data-action='edit']").addEventListener("click", () => editTask(task.id));
    card.querySelector("[data-action='delete']").addEventListener("click", () => deleteTask(task.id));
    taskList.append(card);
  });
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function showMessage(text) {
  message.textContent = text;
}
