const API_URL = "http://localhost:4102/api/courses";

export async function listCourses(filters) {
  return request(`${API_URL}?${new URLSearchParams(filters)}`);
}

export async function createCourse(course) {
  return request(API_URL, { method: "POST", body: JSON.stringify(course) });
}

export async function updateCourse(id, course) {
  return request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(course) });
}

export async function deleteCourse(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
