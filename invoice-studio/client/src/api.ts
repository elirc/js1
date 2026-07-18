import type { Client, Invoice, InvoiceStatus, InvoiceSummary, NewInvoice } from "../../shared/types";

const BASE = "http://localhost:4110/api";

export function listClients() {
  return request<Client[]>("/clients");
}

export function createClient(input: { name: string; email: string }) {
  return request<Client>("/clients", { method: "POST", body: JSON.stringify(input) });
}

export function listInvoices(status: InvoiceStatus | "all") {
  const suffix = status === "all" ? "" : `?status=${status}`;
  return request<InvoiceSummary[]>(`/invoices${suffix}`);
}

export function getInvoice(id: string) {
  return request<Invoice>(`/invoices/${id}`);
}

export function createInvoice(input: NewInvoice) {
  return request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(input) });
}

export function updateInvoice(id: string, input: NewInvoice) {
  return request<Invoice>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function setStatus(id: string, status: InvoiceStatus) {
  return request<Invoice>(`/invoices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function deleteInvoice(id: string) {
  return request<null>(`/invoices/${id}`, { method: "DELETE" });
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
