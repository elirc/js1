const BASE = "http://localhost:4109/api";

export async function listProducts(query) {
  const params = new URLSearchParams(query);
  return request(`/products?${params}`);
}

export async function listCategories() {
  return request("/categories");
}

export async function createProduct(product) {
  return request("/products", { method: "POST", body: JSON.stringify(product) });
}

export async function updateProduct(id, product) {
  return request(`/products/${id}`, { method: "PUT", body: JSON.stringify(product) });
}

export async function deleteProduct(id) {
  return request(`/products/${id}`, { method: "DELETE" });
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
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
