import type { ChatMessage, Room } from "../../shared/types";

const BASE = "http://localhost:4115/api";
export const WS_URL = "ws://localhost:4115";

export function listRooms() {
  return request<Room[]>("/rooms");
}

export function createRoom(input: { slug: string; name: string }) {
  return request<Room>("/rooms", { method: "POST", body: JSON.stringify(input) });
}

export function listMessages(slug: string) {
  return request<ChatMessage[]>(`/rooms/${slug}/messages`);
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
