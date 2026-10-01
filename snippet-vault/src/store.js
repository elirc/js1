// store.js — owns the data and every mutation. No DOM access lives here.

const STORAGE_KEY = "js1-snippet-vault";

const starterSnippets = [
  {
    id: crypto.randomUUID(),
    title: "Debounce helper",
    language: "JavaScript",
    tags: ["utility", "events"],
    code: "function debounce(fn, ms) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}",
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    title: "Center a box",
    language: "CSS",
    tags: ["layout", "flexbox"],
    code: ".center {\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}",
    createdAt: new Date().toISOString()
  }
];

let snippets = load();

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : starterSnippets;
}

function commit(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  snippets = next;
}

function parseTags(raw) {
  const seen = new Set();
  return raw.split(",").map((tag) => tag.trim()).filter((tag) => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The two errors this module raises on purpose. Their wording is meant for a
// person, so a UI may show them as-is; anything else (a storage quota failure,
// a bug) must not be shown raw. Exported so main.js does not have to keep a
// second copy of the list, and so this rule can be tested without a DOM.
export const STORE_ERROR_MESSAGES = Object.freeze([
  "Add a title and some code.",
  "This snippet no longer exists."
]);

export function isUserFacingError(error) {
  return error instanceof Error && STORE_ERROR_MESSAGES.includes(error.message);
}

export function getSnippet(id) {
  return snippets.find((snippet) => snippet.id === id);
}

export function listSnippets({ query = "", language = "All" } = {}) {
  const needle = query.trim().toLowerCase();
  return snippets.filter((snippet) => {
    const matchesLanguage = language === "All" || snippet.language === language;
    const haystack = `${snippet.title} ${snippet.code} ${snippet.tags.join(" ")}`.toLowerCase();
    return matchesLanguage && haystack.includes(needle);
  });
}

export function saveSnippet(input) {
  const base = {
    title: input.title.trim(),
    language: input.language,
    tags: parseTags(input.tags),
    code: input.code
  };

  if (!base.title || !base.code.trim()) throw new Error("Add a title and some code.");
  if (input.id && !snippets.some((item) => item.id === input.id)) throw new Error("This snippet no longer exists.");
  const next = input.id
    ? snippets.map((snippet) => snippet.id === input.id ? { ...snippet, ...base } : snippet)
    : [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base }, ...snippets];
  commit(next);
}

export function deleteSnippet(id) {
  commit(snippets.filter((snippet) => snippet.id !== id));
}
