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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

function parseTags(raw) {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

  if (input.id) {
    snippets = snippets.map((snippet) =>
      snippet.id === input.id ? { ...snippet, ...base } : snippet
    );
  } else {
    snippets.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base });
  }
  persist();
}

export function deleteSnippet(id) {
  snippets = snippets.filter((snippet) => snippet.id !== id);
  persist();
}
