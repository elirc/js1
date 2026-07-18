const API_URL = "http://localhost:4104/api/applications";

export const listApplications = (filters) => request(`${API_URL}?${new URLSearchParams(filters)}`);
export const createApplication = (application) => request(API_URL, { method: "POST", body: JSON.stringify(application) });
export const updateApplication = (id, application) => request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(application) });
export const deleteApplication = (id) => request(`${API_URL}/${id}`, { method: "DELETE" });

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
