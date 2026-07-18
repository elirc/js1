import type { DailyMetric, Freshness, Summary, TopProduct } from "../../shared/types";

const BASE = "http://localhost:4117/api";

export function getDaily(days: number) {
  return request<DailyMetric[]>(`/metrics/daily?days=${days}`);
}

export function getSummary(days: number) {
  return request<Summary>(`/metrics/summary?days=${days}`);
}

export function getTopProducts(days: number) {
  return request<TopProduct[]>(`/metrics/top-products?days=${days}`);
}

export function getFreshness() {
  return request<Freshness>("/metrics/freshness");
}

export function addSampleEvents() {
  return request<Freshness>("/events/sample", { method: "POST" });
}

export function refreshView() {
  return request<Freshness>("/metrics/refresh", { method: "POST" });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (response.status === 204) return null as T;
  const data = await response.json();
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "Request failed.");
  return data as T;
}
