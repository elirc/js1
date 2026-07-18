import type { NewNode, NodeDetail, TreeNode } from "../../shared/types";

const BASE = "http://localhost:4116/api";

export function getTree() {
  return request<TreeNode[]>("/tree");
}

export function getNode(id: string) {
  return request<NodeDetail>(`/nodes/${id}`);
}

export function createNode(input: NewNode) {
  return request<unknown>("/nodes", { method: "POST", body: JSON.stringify(input) });
}

export function renameNode(id: string, input: { name: string; title: string }) {
  return request<unknown>(`/nodes/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function moveNode(id: string, newParentId: string | null) {
  return request<unknown>(`/nodes/${id}/move`, { method: "PATCH", body: JSON.stringify({ newParentId }) });
}

export function deleteNode(id: string) {
  return request<null>(`/nodes/${id}`, { method: "DELETE" });
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
