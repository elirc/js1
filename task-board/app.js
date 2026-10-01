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

const savedBoard = loadBoard();
const state = {
  tasks: savedBoard.tasks,
  deleted: savedBoard.deleted,
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
const undoButton = document.querySelector("#undo-delete");
undoButton.addEventListener("click", undoDelete);

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

function loadBoard() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { tasks: starterTasks, deleted: null };
  const parsed = JSON.parse(saved);
  // Existing installations stored only an array. Upgrade without discarding it.
  if (Array.isArray(parsed)) return { tasks: parsed, deleted: null };
  return { tasks: parsed.tasks, deleted: parsed.deleted ?? null };
}

// Raw, unguarded write. Application paths go through commitBoard; this remains
// for fixtures that mutate `state` directly (see test/undo.test.cjs case 2).
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tasks: state.tasks, deleted: state.deleted }));
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

  const nextTasks = state.editingId
    ? state.tasks.map((item) => item.id === state.editingId ? task : item)
    : [task, ...state.tasks];

  // Create and edit obey the same persist-then-publish rule as delete and undo.
  if (!commitBoard(nextTasks, state.deleted)) return;

  showMessage(state.editingId ? "Task updated." : "Task added.");
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

function commitBoard(tasks, deleted) {
  try {
    // Persist first. A quota/security error must not consume an undo or hide a task.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tasks, deleted }));
  } catch {
    showMessage("Could not save this change. Your task and undo history are unchanged.");
    return false;
  }
  state.tasks = tasks;
  state.deleted = deleted;
  return true;
}

function deleteTask(id) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const deleted = { task: state.tasks[index], index };
  if (!commitBoard(state.tasks.filter((task) => task.id !== id), deleted)) return;
  resetForm();
  showMessage("Task deleted. You can undo the most recent deletion, even after reload.");
  render();
}

function undoDelete() {
  if (!state.deleted) return;
  const { task, index } = state.deleted;
  if (state.tasks.some((item) => item.id === task.id)) {
    showMessage("That task already exists; undo would create a duplicate.");
    return;
  }
  const tasks = [...state.tasks];
  tasks.splice(Math.min(index, tasks.length), 0, task);
  if (!commitBoard(tasks, null)) return;
  // Reveal the restored task even if an old filter would hide it.
  state.query = ""; state.status = "All";
  searchInput.value = ""; statusFilter.value = "All";
  showMessage("Task restored.");
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
  undoButton.disabled = !state.deleted;
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
