const API_URL = "http://localhost:4101/api/issues";

export async function listIssues(filters) {
  const params = new URLSearchParams(filters);
  return request(`${API_URL}?${params}`);
}

export async function createIssue(issue) {
  return request(API_URL, {
    method: "POST",
    body: JSON.stringify(issue)
  });
}

export async function updateIssue(id, issue) {
  return request(`${API_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(issue)
  });
}

export async function deleteIssue(id) {
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
