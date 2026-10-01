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
  return normalizeAmounts(saved ? JSON.parse(saved) : starterTransactions);
}

// Records written by an earlier build were not bounded to two decimals, so a
// stored 0.105 would be displayed as $0.11 by formatCurrency while the ledger
// total counted Math.round(0.105 * 100) = 11 cents. Those agree here, but
// 0.005 rounds to 1 cent in the total and displays as $0.01 in the row while
// the stored value keeps three decimals - one edit later the two disagree.
// Snap every amount to the cent once, at the boundary where the data enters
// the program. Nothing is written back: the normalized value is persisted by
// the next successful commitTransactions, so a read can never fail a write.
function normalizeAmounts(records) {
  if (!Array.isArray(records)) return records;
  return records.map((record) => {
    const cents = Math.round(Number(record.amount) * 100);
    if (!Number.isFinite(cents)) return record;
    const snapped = cents / 100;
    return snapped === record.amount ? record : { ...record, amount: snapped };
  });
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
    amount: parseCents(amountInput.value) / 100,
    date: dateInput.value
  };

  if (!transaction.description || !transaction.category || !isRealDate(transaction.date) || !Number.isFinite(transaction.amount) || !["income", "expense"].includes(transaction.type)) {
    setMessage("Use a description, category, real date, and a positive amount with at most two decimal places (maximum 999999999.99).");
    return;
  }

  const next = editingId
    ? transactions.map((current) => current.id === editingId ? { ...transaction, id: editingId } : current)
    : [transaction, ...transactions];
  if (!commitTransactions(next)) return;
  setMessage(editingId ? "Transaction updated." : "Transaction added.");
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
  if (!commitTransactions(transactions.filter((transaction) => transaction.id !== id))) return;
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
    summary[transaction.type] += Math.round(transaction.amount * 100);
    return summary;
  }, { income: 0, expense: 0 });

  incomeTotal.textContent = formatCurrency(totals.income / 100);
  expenseTotal.textContent = formatCurrency(totals.expense / 100);
  balanceTotal.textContent = formatCurrency((totals.income - totals.expense) / 100);
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

function parseCents(text) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return NaN;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 99999999999 ? cents : NaN;
}

function isRealDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function commitTransactions(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { setMessage("Could not save. Your transactions are unchanged; try again."); return false; }
  transactions = next;
  return true;
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
