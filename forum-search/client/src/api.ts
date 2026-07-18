import type { NewThread, Tag, Thread, ThreadPage, User } from "../../shared/types";

const BASE = "http://localhost:4114/api";

export interface ThreadQuery {
  q?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export function listUsers() {
  return request<User[]>("/users");
}

export function listTags() {
  return request<Tag[]>("/tags");
}

export function searchThreads(queryParams: ThreadQuery) {
  const params = new URLSearchParams();
  if (queryParams.q) params.set("q", queryParams.q);
  if (queryParams.tag) params.set("tag", queryParams.tag);
  params.set("page", String(queryParams.page ?? 1));
  params.set("pageSize", String(queryParams.pageSize ?? 5));
  return request<ThreadPage>(`/threads?${params}`);
}

export function createThread(input: NewThread) {
  return request<Thread>("/threads", { method: "POST", body: JSON.stringify(input) });
}

export function deleteThread(id: string) {
  return request<null>(`/threads/${id}`, { method: "DELETE" });
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
