const BASE = "http://localhost:4226/api/units";

export function listItems(query) { return request(BASE + "?" + new URLSearchParams(query)); }
export function getStats() { return request(BASE + "/stats"); }
export function createItem(item) { return request(BASE, { method: "POST", body: JSON.stringify(item) }); }
export function updateItem(id, item) { return request(BASE + "/" + id, { method: "PUT", body: JSON.stringify(item) }); }
export function updateStatus(id, status) { return request(BASE + "/" + id + "/status", { method: "PATCH", body: JSON.stringify({ status }) }); }
export function deleteItem(id) { return request(BASE + "/" + id, { method: "DELETE" }); }
export function listActivity(id) { return request(BASE + "/" + id + "/activity"); }
export function addActivity(id, body) { return request(BASE + "/" + id + "/activity", { method: "POST", body: JSON.stringify({ kind: "note", body }) }); }

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
