const STORAGE_KEY = "js1-focus-timer";

// The timer is a small state machine. `mode` is one of:
//   "idle"    -> nothing scheduled, display shows the configured length
//   "running" -> an interval is ticking down `remaining`
//   "paused"  -> interval cleared, `remaining` frozen
const timer = {
  mode: "idle",
  remaining: 25 * 60, // seconds
  deadline: null,
  duration: 25 * 60,
  intervalId: null
};

const state = {
  sessions: loadSessions(),
  editingId: null
};

const display = document.querySelector("#timer-display");
const statusText = document.querySelector("#timer-status");
const labelInput = document.querySelector("#session-label");
const minutesInput = document.querySelector("#session-minutes");
const startButton = document.querySelector("#start-button");
const resetButton = document.querySelector("#reset-button");
const message = document.querySelector("#form-message");
const todayTotal = document.querySelector("#today-total");
const sessionList = document.querySelector("#session-list");
const sessionCount = document.querySelector("#session-count");
const emptyState = document.querySelector("#empty-state");

startButton.addEventListener("click", onStartButton);
resetButton.addEventListener("click", resetTimer);
minutesInput.addEventListener("change", () => {
  if (timer.mode === "idle") {
    timer.remaining = configuredSeconds();
    renderTimer();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});
renderTimer();
renderSessions();

function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function commitSessions(next) {
  try {
    // Persist first. A failed write must not leave a session on screen
    // that the next reload will erase.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  state.sessions = next;
  return true;
}

function configuredSeconds() {
  const minutes = Math.min(120, Math.max(1, Number(minutesInput.value) || 1));
  return minutes * 60;
}

function onStartButton() {
  if (timer.mode === "running") {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (timer.mode === "running") return;
  clearInterval(timer.intervalId);
  if (timer.mode === "idle") {
    timer.remaining = configuredSeconds();
    timer.duration = timer.remaining;
  }
  timer.deadline = Date.now() + timer.remaining * 1000;
  timer.mode = "running";
  minutesInput.disabled = true;
  timer.intervalId = setInterval(tick, 1000);
  renderTimer();
  showMessage("");
}

function pauseTimer() {
  if (timer.mode !== "running") return;
  timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
  if (timer.remaining === 0) { completeSession(); return; }
  timer.deadline = null;
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.mode = "paused";
  renderTimer();
}

function resetTimer() {
  timer.deadline = null;
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.mode = "idle";
  timer.remaining = configuredSeconds();
  minutesInput.disabled = false;
  renderTimer();
  showMessage("");
}

function tick() {
  if (timer.mode !== "running") return;
  timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
  if (timer.remaining <= 0) {
    completeSession();
    return;
  }
  renderTimer();
}

function completeSession() {
  if (timer.mode !== "running") return;
  timer.mode = "idle";
  timer.deadline = null;
  clearInterval(timer.intervalId);
  timer.intervalId = null;

  const minutes = Math.round(timer.duration / 60);
  const session = {
    id: crypto.randomUUID(),
    label: labelInput.value.trim() || "Focus session",
    minutes,
    completedAt: new Date().toISOString()
  };
  // The session really did finish, so the timer resets either way. Only the log is conditional.
  const logged = commitSessions([session, ...state.sessions]);

  timer.remaining = configuredSeconds();
  minutesInput.disabled = false;

  renderTimer();
  renderSessions();
  showMessage(logged
    ? "Session complete and logged."
    : "Session complete, but it could not be saved. Your earlier sessions are unchanged.");
}

function editSession(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  const next = prompt("Rename session", session.label);
  if (next === null) return;
  const label = next.trim();
  if (!label) return;
  const renamed = state.sessions.map((item) =>
    item.id === id ? { ...item, label } : item
  );
  if (!commitSessions(renamed)) {
    showMessage("Could not rename this session. Nothing was changed.");
    return;
  }
  renderSessions();
}

function deleteSession(id) {
  if (!commitSessions(state.sessions.filter((session) => session.id !== id))) {
    showMessage("Could not delete this session. Nothing was changed.");
    return;
  }
  renderSessions();
}

function renderTimer() {
  display.textContent = formatClock(Math.ceil(timer.remaining));
  const labels = { idle: "Ready", running: "Focusing…", paused: "Paused" };
  statusText.textContent = labels[timer.mode];
  startButton.textContent = timer.mode === "running" ? "Pause" : timer.mode === "paused" ? "Resume" : "Start";
  display.classList.toggle("active", timer.mode === "running");
}

function renderSessions() {
  sessionList.innerHTML = "";
  sessionCount.textContent = state.sessions.length;
  emptyState.hidden = state.sessions.length > 0;

  state.sessions.forEach((session) => {
    const card = document.createElement("article");
    card.className = "session-card";

    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = session.label;
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = `${session.minutes} min · ${formatTime(session.completedAt)}`;
    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Rename", "secondary", () => editSession(session.id)),
      makeButton("Delete", "danger", () => deleteSession(session.id))
    );

    card.append(info, actions);
    sessionList.append(card);
  });

  renderTodayTotal();
}

function renderTodayTotal() {
  const today = new Date().toDateString();
  const minutes = state.sessions
    .filter((session) => new Date(session.completedAt).toDateString() === today)
    .reduce((sum, session) => sum + session.minutes, 0);

  todayTotal.textContent = minutes === 0
    ? "No focus time logged today."
    : `Focused ${minutes} minutes today across ${countToday(today)} session(s).`;
}

function countToday(today) {
  return state.sessions.filter(
    (session) => new Date(session.completedAt).toDateString() === today
  ).length;
}

function makeButton(label, variant, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  if (variant) button.className = variant;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function showMessage(text) {
  message.textContent = text;
}
