const STORAGE_KEY = "js1-reading-list";

const starterBooks = [
  {
    id: crypto.randomUUID(),
    title: "The Pragmatic Programmer",
    author: "David Thomas and Andrew Hunt",
    status: "Reading",
    rating: "0",
    notes: "Focus on small habits and feedback loops."
  },
  {
    id: crypto.randomUUID(),
    title: "Refactoring",
    author: "Martin Fowler",
    status: "Want to Read",
    rating: "0",
    notes: "Compare examples with current projects."
  }
];

let books = loadBooks();
let editingId = null;
let searchTerm = "";
let sortMode = "title";
let statusFilter = "All";

const form = document.querySelector("#book-form");
const idInput = document.querySelector("#book-id");
const titleInput = document.querySelector("#title");
const authorInput = document.querySelector("#author");
const statusInput = document.querySelector("#status");
const ratingInput = document.querySelector("#rating");
const notesInput = document.querySelector("#notes");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");
const searchInput = document.querySelector("#search");
const sortInput = document.querySelector("#sort");
const booksList = document.querySelector("#books");
const empty = document.querySelector("#empty");

document.querySelector("#status-filter").addEventListener("change", (event) => {
  statusFilter = event.target.value;
  renderBooks();
});

form.addEventListener("submit", saveBook);
cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderBooks();
});
sortInput.addEventListener("change", (event) => {
  sortMode = event.target.value;
  renderBooks();
});

renderBooks();

function loadBooks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterBooks;
}

function persistBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function saveBook(event) {
  event.preventDefault();

  const book = {
    id: idInput.value || crypto.randomUUID(),
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    status: statusInput.value,
    rating: ratingInput.value,
    notes: notesInput.value.trim()
  };

  if (!book.title || !book.author) {
    setMessage("Title and author are required.");
    return;
  }

  if (editingId) {
    books = books.map((current) => current.id === editingId ? book : current);
    setMessage("Book updated.");
  } else {
    books.unshift(book);
    setMessage("Book added.");
  }

  persistBooks();
  resetForm();
  renderBooks();
}

function editBook(id) {
  const book = books.find((current) => current.id === id);
  if (!book) return;

  editingId = id;
  idInput.value = book.id;
  titleInput.value = book.title;
  authorInput.value = book.author;
  statusInput.value = book.status;
  ratingInput.value = book.rating;
  notesInput.value = book.notes;
  saveButton.textContent = "Update book";
  cancelButton.hidden = false;
  titleInput.focus();
}

function deleteBook(id) {
  books = books.filter((book) => book.id !== id);
  persistBooks();
  resetForm();
  setMessage("Book deleted.");
  renderBooks();
}

function resetForm() {
  form.reset();
  idInput.value = "";
  editingId = null;
  saveButton.textContent = "Add book";
  cancelButton.hidden = true;
}

function getVisibleBooks() {
  return [...books]
    .filter((book) => {
      const searchable = `${book.title} ${book.author} ${book.status} ${book.notes}`.toLowerCase();
      return (statusFilter === "All" || book.status === statusFilter) && searchable.includes(searchTerm);
    })
    .sort((a, b) => {
      // Ids are coerced with String() because records written by an older build
      // (or hand-edited in localStorage) can carry a numeric id, and Number has
      // no localeCompare. The tie-break must never be the thing that throws.
      const byId = String(a.id).localeCompare(String(b.id));
      if (sortMode === "rating") {
        return Number(b.rating) - Number(a.rating) || a.title.localeCompare(b.title) || byId;
      }
      return String(a[sortMode]).localeCompare(String(b[sortMode])) || byId;
    });
}

function renderBooks() {
  const visibleBooks = getVisibleBooks();
  document.querySelector("#reading-summary").textContent = `Showing ${visibleBooks.length} of ${books.length} books. ${books.filter((book) => book.status === "Finished").length} finished overall.`;
  booksList.innerHTML = "";
  empty.hidden = visibleBooks.length > 0;

  visibleBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";
    card.innerHTML = `
      <h2></h2>
      <p class="author"></p>
      <div class="meta">
        <span class="tag status"></span>
        <span class="tag rating"></span>
      </div>
      <p class="notes"></p>
      <div class="book-actions">
        <button type="button" data-action="edit">Edit</button>
        <button type="button" class="danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector("h2").textContent = book.title;
    card.querySelector(".author").textContent = `By ${book.author}`;
    card.querySelector(".status").textContent = book.status;
    card.querySelector(".rating").textContent = Number(book.rating) ? `${book.rating} / 5` : "Not rated";
    card.querySelector(".notes").textContent = book.notes || "No notes yet.";
    card.querySelector("[data-action='edit']").addEventListener("click", () => editBook(book.id));
    card.querySelector("[data-action='delete']").addEventListener("click", () => deleteBook(book.id));
    booksList.append(card);
  });
}

function setMessage(text) {
  message.textContent = text;
}
