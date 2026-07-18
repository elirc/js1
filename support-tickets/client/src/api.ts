import type { Agent, Label, NewTicket, Ticket, TicketEvent, TicketStatus } from "../../shared/types";

const BASE = "http://localhost:4111/api";

export interface TicketFilters {
  status?: string;
  priority?: string;
  label?: string;
  assignee?: string;
  search?: string;
}

export function listAgents() {
  return request<Agent[]>("/agents");
}

export function listLabels() {
  return request<Label[]>("/labels");
}

export function listTickets(filters: TicketFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return request<Ticket[]>(`/tickets?${params}`);
}

export function listEvents(id: string) {
  return request<TicketEvent[]>(`/tickets/${id}/events`);
}

export function createTicket(input: NewTicket) {
  return request<Ticket>("/tickets", { method: "POST", body: JSON.stringify(input) });
}

export function setStatus(id: string, status: TicketStatus) {
  return request<Ticket>(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function setAssignee(id: string, assigneeId: string | null) {
  return request<Ticket>(`/tickets/${id}/assignee`, { method: "PATCH", body: JSON.stringify({ assigneeId }) });
}

export function deleteTicket(id: string) {
  return request<null>(`/tickets/${id}`, { method: "DELETE" });
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
