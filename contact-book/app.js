const STORAGE_KEY = "js1-contact-book";

const sampleContacts = [
  {
    id: crypto.randomUUID(),
    name: "Maya Patel",
    email: "maya@example.com",
    phone: "555-0198",
    company: "Northwind Labs",
    relationship: "Colleague"
  },
  {
    id: crypto.randomUUID(),
    name: "Noah Brooks",
    email: "noah@example.com",
    phone: "555-0142",
    company: "Brooks Design",
    relationship: "Client"
  }
];

let contacts = loadContacts();
let editingId = null;
let searchTerm = "";

const form = document.querySelector("#contact-form");
const idInput = document.querySelector("#contact-id");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const phoneInput = document.querySelector("#phone");
const companyInput = document.querySelector("#company");
const relationshipInput = document.querySelector("#relationship");
const saveButton = document.querySelector("#save-button");
const clearButton = document.querySelector("#clear-button");
const message = document.querySelector("#message");
const searchInput = document.querySelector("#search");
const contactsList = document.querySelector("#contacts");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");

form.addEventListener("submit", saveContact);
clearButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderContacts();
});

emailInput.addEventListener("input", () => emailInput.removeAttribute("aria-invalid"));
renderContacts();

function loadContacts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : sampleContacts;
}

function commitContacts(next) {
  try {
    // Persist first. A quota/security error must not leave the screen showing
    // a contact that will disappear on the next reload.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    setMessage("Could not save. Your contacts are unchanged.");
    return false;
  }
  contacts = next;
  return true;
}

function saveContact(event) {
  event.preventDefault();

  const contact = {
    id: idInput.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    company: companyInput.value.trim(),
    relationship: relationshipInput.value
  };

  if (!contact.name || !contact.email || !contact.phone) {
    setMessage("Name, email, and phone are required.");
    return;
  }

  const duplicate = contacts.find((item) =>
    item.id !== editingId && item.email.trim().toLowerCase() === contact.email.toLowerCase()
  );
  if (duplicate) {
    setMessage(`A contact with this email already exists: ${duplicate.name}.`);
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
    return;
  }
  emailInput.removeAttribute("aria-invalid");

  const next = editingId
    ? contacts.map((item) => item.id === editingId ? contact : item)
    : [contact, ...contacts];

  // Validation passed. Persist before publishing, and keep the form usable if the write fails.
  if (!commitContacts(next)) return;

  setMessage(editingId ? "Contact updated." : "Contact added.");
  resetForm();
  renderContacts();
}

function editContact(id) {
  const contact = contacts.find((item) => item.id === id);
  if (!contact) return;

  editingId = id;
  idInput.value = contact.id;
  nameInput.value = contact.name;
  emailInput.value = contact.email;
  phoneInput.value = contact.phone;
  companyInput.value = contact.company;
  relationshipInput.value = contact.relationship;
  saveButton.textContent = "Update contact";
  clearButton.hidden = false;
  nameInput.focus();
}

function deleteContact(id) {
  if (!commitContacts(contacts.filter((contact) => contact.id !== id))) return;
  resetForm();
  setMessage("Contact deleted.");
  renderContacts();
}

function resetForm() {
  emailInput.removeAttribute("aria-invalid");
  form.reset();
  idInput.value = "";
  editingId = null;
  saveButton.textContent = "Add contact";
  clearButton.hidden = true;
}

function getFilteredContacts() {
  return contacts.filter((contact) => {
    const searchable = `${contact.name} ${contact.email} ${contact.phone} ${contact.company} ${contact.relationship}`.toLowerCase();
    return searchable.includes(searchTerm);
  });
}

function renderContacts() {
  const visibleContacts = getFilteredContacts();
  contactsList.innerHTML = "";
  count.textContent = visibleContacts.length;
  empty.hidden = visibleContacts.length > 0;

  visibleContacts.forEach((contact) => {
    const card = document.createElement("article");
    card.className = "contact-card";
    card.innerHTML = `
      <h3></h3>
      <p class="company"></p>
      <p class="email"></p>
      <p class="phone"></p>
      <span class="badge"></span>
      <div class="card-footer">
        <button type="button" data-action="edit">Edit</button>
        <button type="button" class="danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector("h3").textContent = contact.name;
    card.querySelector(".company").textContent = contact.company || "No company";
    card.querySelector(".email").textContent = contact.email;
    card.querySelector(".phone").textContent = contact.phone;
    card.querySelector(".badge").textContent = contact.relationship;
    card.querySelector("[data-action='edit']").addEventListener("click", () => editContact(contact.id));
    card.querySelector("[data-action='delete']").addEventListener("click", () => deleteContact(contact.id));
    contactsList.append(card);
  });
}

function setMessage(text) {
  message.textContent = text;
}
