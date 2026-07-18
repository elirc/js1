const BASE = "http://localhost:4108/api";
const TOKEN_KEY = "js1-secure-notes-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function register(credentials) {
  const session = await request("/auth/register", { method: "POST", body: JSON.stringify(credentials) });
  setToken(session.token);
  return session.user;
}

export async function login(credentials) {
  const session = await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  setToken(session.token);
  return session.user;
}

export async function logout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export async function me() {
  return request("/auth/me");
}

export async function listNotes() {
  return request("/notes");
}

export async function createNote(note) {
  return request("/notes", { method: "POST", body: JSON.stringify(note) });
}

export async function updateNote(id, note) {
  return request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(note) });
}

export async function deleteNote(id) {
  return request(`/notes/${id}`, { method: "DELETE" });
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    setToken(null);
    const data = await safeJson(response);
    throw new Error(data?.error || "Please sign in again.");
  }
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
