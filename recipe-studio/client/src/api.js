const API_URL = "http://localhost:4103/api/recipes";

export const listRecipes = (filters) => request(`${API_URL}?${new URLSearchParams(filters)}`);
export const createRecipe = (recipe) => request(API_URL, { method: "POST", body: JSON.stringify(recipe) });
export const updateRecipe = (id, recipe) => request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(recipe) });
export const deleteRecipe = (id) => request(`${API_URL}/${id}`, { method: "DELETE" });

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
