const API_URL = "http://localhost:4107/api/posts";

export async function listPosts() {
  return request(API_URL);
}

export async function createPost(post) {
  return request(API_URL, { method: "POST", body: JSON.stringify(post) });
}

export async function updatePost(id, post) {
  return request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(post) });
}

export async function deletePost(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

export async function listComments(postId) {
  return request(`${API_URL}/${postId}/comments`);
}

export async function addComment(postId, comment) {
  return request(`${API_URL}/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(comment)
  });
}

export async function deleteComment(postId, commentId) {
  return request(`${API_URL}/${postId}/comments/${commentId}`, { method: "DELETE" });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
