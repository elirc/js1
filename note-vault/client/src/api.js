const API_URL = "http://localhost:4106/api/notes";

export async function listNotes(filters) {
  const params = new URLSearchParams(filters);
  return request(`${API_URL}?${params}`);
}

export async function createNote(note) {
  return request(API_URL, { method: "POST", body: JSON.stringify(note) });
}

export async function updateNote(id, note) {
  return request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(note) });
}

export async function togglePin(id) {
  return request(`${API_URL}/${id}/pin`, { method: "PATCH" });
}

export async function deleteNote(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
