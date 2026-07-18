const API_URL = "http://localhost:4105/api/events";

export const listEvents = (filters) => request(`${API_URL}?${new URLSearchParams(filters)}`);
export const createEvent = (event) => request(API_URL, { method: "POST", body: JSON.stringify(event) });
export const updateEvent = (id, event) => request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(event) });
export const deleteEvent = (id) => request(`${API_URL}/${id}`, { method: "DELETE" });

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
