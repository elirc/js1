import type { ActivityEntry, Item, NewItem, Page, Stats } from "../../shared/types";

const BASE = "http://localhost:4232/api/assets";

export function listItems(query: Record<string, string | number>): Promise<Page<Item>> {
  return request(BASE + "?" + new URLSearchParams(query as Record<string, string>));
}

export function getStats(): Promise<Stats> {
  return request(BASE + "/stats");
}

export function createItem(item: NewItem): Promise<Item> {
  return request(BASE, { method: "POST", body: JSON.stringify(item) });
}

export function updateItem(id: string, item: NewItem): Promise<Item> {
  return request(BASE + "/" + id, { method: "PUT", body: JSON.stringify(item) });
}

export function updateStatus(id: string, status: string): Promise<Item> {
  return request(BASE + "/" + id + "/status", { method: "PATCH", body: JSON.stringify({ status }) });
}

export function deleteItem(id: string): Promise<null> {
  return request(BASE + "/" + id, { method: "DELETE" });
}

export function listActivity(id: string): Promise<ActivityEntry[]> {
  return request(BASE + "/" + id + "/activity");
}

export function addActivity(id: string, body: string): Promise<ActivityEntry> {
  return request(BASE + "/" + id + "/activity", { method: "POST", body: JSON.stringify({ kind: "note", body }) });
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null as T;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}
