const STORAGE_KEY = "js1-pantry-inventory";

const sampleItems = [
  {
    id: crypto.randomUUID(),
    name: "Oats",
    category: "Dry goods",
    quantity: 4,
    minimum: 2,
    expires: "2026-09-01"
  },
  {
    id: crypto.randomUUID(),
    name: "Tomato cans",
    category: "Canned",
    quantity: 1,
    minimum: 3,
    expires: "2027-02-15"
  }
];

let items = loadItems();
let editingId = null;
let searchTerm = "";
let activeFilter = "All";

const form = document.querySelector("#item-form");
const idInput = document.querySelector("#item-id");
const nameInput = document.querySelector("#item-name");
const categoryInput = document.querySelector("#category");
const quantityInput = document.querySelector("#quantity");
const minimumInput = document.querySelector("#minimum");
const expiresInput = document.querySelector("#expires");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");
const searchInput = document.querySelector("#search");
const filterInput = document.querySelector("#filter");
const itemsBody = document.querySelector("#items");
const empty = document.querySelector("#empty");
const totalItems = document.querySelector("#total-items");
const lowItems = document.querySelector("#low-items");

form.addEventListener("submit", saveItem);
cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderItems();
});
filterInput.addEventListener("change", (event) => {
  activeFilter = event.target.value;
  renderItems();
});

renderItems();

function loadItems() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : sampleItems;
}

function persistItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function saveItem(event) {
  event.preventDefault();

  const item = {
    id: idInput.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    category: categoryInput.value,
    quantity: Number(quantityInput.value),
    minimum: Number(minimumInput.value),
    expires: expiresInput.value
  };

  if (!item.name || !item.expires || item.quantity < 0 || item.minimum < 0) {
    setMessage("Add a valid name, quantities, and expiration date.");
    return;
  }

  if (editingId) {
    items = items.map((current) => current.id === editingId ? item : current);
    setMessage("Item updated.");
  } else {
    items.unshift(item);
    setMessage("Item added.");
  }

  persistItems();
  resetForm();
  renderItems();
}

function editItem(id) {
  const item = items.find((current) => current.id === id);
  if (!item) return;

  editingId = id;
  idInput.value = item.id;
  nameInput.value = item.name;
  categoryInput.value = item.category;
  quantityInput.value = item.quantity;
  minimumInput.value = item.minimum;
  expiresInput.value = item.expires;
  submitButton.textContent = "Update item";
  cancelButton.hidden = false;
  nameInput.focus();
}

function deleteItem(id) {
  items = items.filter((item) => item.id !== id);
  persistItems();
  resetForm();
  setMessage("Item deleted.");
  renderItems();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  quantityInput.value = 1;
  minimumInput.value = 1;
  editingId = null;
  submitButton.textContent = "Add item";
  cancelButton.hidden = true;
}

function getVisibleItems() {
  return items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(searchTerm);
    const isLow = item.quantity <= item.minimum;
    const matchesFilter = activeFilter === "All" || (activeFilter === "Low" && isLow) || (activeFilter === "Fresh" && !isLow);
    return matchesSearch && matchesFilter;
  });
}

function renderItems() {
  const visibleItems = getVisibleItems();
  itemsBody.innerHTML = "";
  empty.hidden = visibleItems.length > 0;
  totalItems.textContent = items.length;
  lowItems.textContent = items.filter((item) => item.quantity <= item.minimum).length;

  visibleItems.forEach((item) => {
    const row = document.createElement("tr");
    const statusText = item.quantity <= item.minimum ? "Low" : "Fresh";
    row.innerHTML = `
      <td>
        <strong class="name"></strong><br>
        <span class="status"></span>
      </td>
      <td class="category"></td>
      <td class="quantity"></td>
      <td class="expires"></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" class="danger" data-action="delete">Delete</button>
        </div>
      </td>
    `;

    row.querySelector(".name").textContent = item.name;
    row.querySelector(".category").textContent = item.category;
    row.querySelector(".quantity").textContent = `${item.quantity} / low at ${item.minimum}`;
    row.querySelector(".expires").textContent = formatDate(item.expires);
    const status = row.querySelector(".status");
    status.textContent = statusText;
    status.classList.toggle("low", statusText === "Low");
    row.querySelector("[data-action='edit']").addEventListener("click", () => editItem(item.id));
    row.querySelector("[data-action='delete']").addEventListener("click", () => deleteItem(item.id));
    itemsBody.append(row);
  });
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function setMessage(text) {
  message.textContent = text;
}
