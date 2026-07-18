import type { Movement, NewMovement, Product, StockLevel, Transfer, Warehouse } from "../../shared/types";

const BASE = "http://localhost:4113/api";

export function listProducts() {
  return request<Product[]>("/products");
}

export function listWarehouses() {
  return request<Warehouse[]>("/warehouses");
}

export function listStock() {
  return request<StockLevel[]>("/stock");
}

export function listLedger(productId: string) {
  return request<Movement[]>(`/products/${productId}/ledger`);
}

export function recordMovement(input: NewMovement) {
  return request<{ ok: true }>("/movements", { method: "POST", body: JSON.stringify(input) });
}

export function transfer(input: Transfer) {
  return request<{ ok: true }>("/transfers", { method: "POST", body: JSON.stringify(input) });
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
