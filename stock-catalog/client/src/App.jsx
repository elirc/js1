import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  updateProduct
} from "./api";
import "./styles.css";

const emptyForm = { name: "", category: "", price: "", stock: "" };
const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Stock" }
];

export default function App() {
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, page: 1 });
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState({
    search: "",
    category: "all",
    sort: "name",
    dir: "asc",
    page: 1,
    pageSize: 5
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, [query]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, [data.total]);

  const rangeLabel = useMemo(() => {
    if (data.total === 0) return "0 results";
    const start = (data.page - 1) * query.pageSize + 1;
    const end = Math.min(data.page * query.pageSize, data.total);
    return `${start}–${end} of ${data.total}`;
  }, [data, query.pageSize]);

  async function refresh() {
    try {
      setData(await listProducts(query));
    } catch (error) {
      setMessage(error.message);
    }
  }

  // Changing a filter or sort resets back to page 1.
  function patchQuery(patch, resetPage = true) {
    setQuery((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }

  function toggleSort(key) {
    if (query.sort === key) {
      patchQuery({ dir: query.dir === "asc" ? "desc" : "asc" });
    } else {
      patchQuery({ sort: key, dir: "asc" });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateProduct(editingId, form);
        setMessage("Product updated.");
      } else {
        await createProduct(form);
        setMessage("Product added.");
      }
      reset();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock)
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function remove(id) {
    await deleteProduct(id);
    if (editingId === id) reset();
    await refresh();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Advanced Project 9</p>
          <h1>Stock Catalog</h1>
        </div>
        <p className="muted">Server-side paging, sorting &amp; filtering</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit product" : "New product"}</h2>
          <label>Name</label>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />

          <label>Category</label>
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />

          <div className="field-row">
            <div>
              <label>Price</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </div>
            <div>
              <label>Stock</label>
              <input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
            </div>
          </div>

          <div className="actions">
            <button type="submit">{editingId ? "Save" : "Add product"}</button>
            {editingId && <button type="button" className="secondary" onClick={reset}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input
              placeholder="Search by name"
              value={query.search}
              onChange={(event) => patchQuery({ search: event.target.value })}
            />
            <select value={query.category} onChange={(event) => patchQuery({ category: event.target.value })}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select value={query.pageSize} onChange={(event) => patchQuery({ pageSize: Number(event.target.value) })}>
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>

          <table className="catalog">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key}>
                    <button type="button" className="sort-button" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      {query.sort === column.key && <span className="arrow">{query.dir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>${product.price.toFixed(2)}</td>
                  <td className={product.stock === 0 ? "out" : ""}>{product.stock}</td>
                  <td className="row-actions">
                    <button type="button" className="link-button" onClick={() => startEdit(product)}>Edit</button>
                    <button type="button" className="link-button danger" onClick={() => remove(product.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan="5" className="muted">No products match this view.</td></tr>
              )}
            </tbody>
          </table>

          <div className="pager">
            <span className="muted">{rangeLabel}</span>
            <div className="pager-controls">
              <button
                type="button"
                className="secondary"
                disabled={data.page <= 1}
                onClick={() => patchQuery({ page: data.page - 1 }, false)}
              >
                Prev
              </button>
              <span className="page-indicator">Page {data.page} / {data.totalPages}</span>
              <button
                type="button"
                className="secondary"
                disabled={data.page >= data.totalPages}
                onClick={() => patchQuery({ page: data.page + 1 }, false)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
