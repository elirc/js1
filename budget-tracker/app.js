const STORAGE_KEY = "js1-budget-tracker";

const starterTransactions = [
  {
    id: crypto.randomUUID(),
    description: "Web design deposit",
    category: "Freelance",
    type: "income",
    amount: 850,
    date: "2026-06-05"
  },
  {
    id: crypto.randomUUID(),
    description: "Course subscription",
    category: "Education",
    type: "expense",
    amount: 39,
    date: "2026-06-08"
  }
];

let transactions = loadTransactions();
let editingId = null;
let searchTerm = "";
let typeFilter = "all";

const form = document.querySelector("#transaction-form");
const idInput = document.querySelector("#transaction-id");
const descriptionInput = document.querySelector("#description");
const categoryInput = document.querySelector("#category");
const typeInput = document.querySelector("#type");
const amountInput = document.querySelector("#amount");
const dateInput = document.querySelector("#date");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");
const searchInput = document.querySelector("#search");
const typeFilterInput = document.querySelector("#type-filter");
const transactionsList = document.querySelector("#transactions");
const empty = document.querySelector("#empty");
const incomeTotal = document.querySelector("#income-total");
const expenseTotal = document.querySelector("#expense-total");
const balanceTotal = document.querySelector("#balance-total");

form.addEventListener("submit", saveTransaction);
cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderTransactions();
});
typeFilterInput.addEventListener("change", (event) => {
  typeFilter = event.target.value;
  renderTransactions();
});

renderTransactions();

function loadTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterTransactions;
}

function persistTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveTransaction(event) {
  event.preventDefault();

  const transaction = {
    id: idInput.value || crypto.randomUUID(),
    description: descriptionInput.value.trim(),
    category: categoryInput.value.trim(),
    type: typeInput.value,
    amount: Number(amountInput.value),
    date: dateInput.value
  };

  if (!transaction.description || !transaction.category || !transaction.date || transaction.amount <= 0) {
    setMessage("Add a valid description, category, amount, and date.");
    return;
  }

  if (editingId) {
    transactions = transactions.map((current) => current.id === editingId ? transaction : current);
    setMessage("Transaction updated.");
  } else {
    transactions.unshift(transaction);
    setMessage("Transaction added.");
  }

  persistTransactions();
  resetForm();
  renderTransactions();
}

function editTransaction(id) {
  const transaction = transactions.find((current) => current.id === id);
  if (!transaction) return;

  editingId = id;
  idInput.value = transaction.id;
  descriptionInput.value = transaction.description;
  categoryInput.value = transaction.category;
  typeInput.value = transaction.type;
  amountInput.value = transaction.amount;
  dateInput.value = transaction.date;
  saveButton.textContent = "Update transaction";
  cancelButton.hidden = false;
  descriptionInput.focus();
}

function deleteTransaction(id) {
  transactions = transactions.filter((transaction) => transaction.id !== id);
  persistTransactions();
  resetForm();
  setMessage("Transaction deleted.");
  renderTransactions();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  editingId = null;
  saveButton.textContent = "Add transaction";
  cancelButton.hidden = true;
}

function getVisibleTransactions() {
  return transactions.filter((transaction) => {
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const searchable = `${transaction.description} ${transaction.category} ${transaction.type}`.toLowerCase();
    return matchesType && searchable.includes(searchTerm);
  });
}

function renderTransactions() {
  const visibleTransactions = getVisibleTransactions();
  const totals = transactions.reduce((summary, transaction) => {
    summary[transaction.type] += transaction.amount;
    return summary;
  }, { income: 0, expense: 0 });

  incomeTotal.textContent = formatCurrency(totals.income);
  expenseTotal.textContent = formatCurrency(totals.expense);
  balanceTotal.textContent = formatCurrency(totals.income - totals.expense);
  transactionsList.innerHTML = "";
  empty.hidden = visibleTransactions.length > 0;

  visibleTransactions.forEach((transaction) => {
    const card = document.createElement("article");
    card.className = "transaction";
    card.innerHTML = `
      <div>
        <h2></h2>
        <p class="details"></p>
      </div>
      <span class="amount"></span>
      <div class="transaction-footer">
        <time></time>
        <div>
          <button type="button" data-action="edit">Edit</button>
          <button type="button" class="danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;

    card.querySelector("h2").textContent = transaction.description;
    card.querySelector(".details").textContent = `${transaction.category} - ${transaction.type}`;
    card.querySelector("time").textContent = formatDate(transaction.date);
    const amount = card.querySelector(".amount");
    amount.textContent = `${transaction.type === "expense" ? "-" : "+"}${formatCurrency(transaction.amount)}`;
    amount.classList.add(transaction.type);
    card.querySelector("[data-action='edit']").addEventListener("click", () => editTransaction(transaction.id));
    card.querySelector("[data-action='delete']").addEventListener("click", () => deleteTransaction(transaction.id));
    transactionsList.append(card);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function setMessage(text) {
  message.textContent = text;
}
