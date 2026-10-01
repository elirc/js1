import type { Booking, NewBooking, Room } from "../../shared/types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4112/api";

export function listRooms() {
  return request<Room[]>("/rooms");
}

export function listBookings(filters: { roomId?: string; date?: string }) {
  const params = new URLSearchParams();
  if (filters.roomId) params.set("roomId", filters.roomId);
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00`);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    params.set("dayStart", start.toISOString());
    params.set("dayEnd", end.toISOString());
  }
  return request<Booking[]>(`/bookings?${params}`);
}

export function createBooking(input: NewBooking) {
  return request<Booking>("/bookings", { method: "POST", body: JSON.stringify(input) });
}

export function updateBooking(id: string, input: NewBooking) {
  return request<Booking>(`/bookings/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteBooking(id: string) {
  return request<null>(`/bookings/${id}`, { method: "DELETE" });
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
