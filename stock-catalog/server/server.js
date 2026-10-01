import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = 4109;

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

const repository = createProductRepository();

const SORTABLE = ["name", "price", "stock", "category"];

// The list route does the heavy lifting on the server: filter, then sort,
// then slice a single page. The client only ever receives one page.
app.get("/api/products", (req, res) => {
  const search = String(req.query.search || "");
  const category = String(req.query.category || "all");
  const sort = SORTABLE.includes(req.query.sort) ? req.query.sort : "name";
  const dir = req.query.dir === "desc" ? "desc" : "asc";
  const page = whole(req.query.page,1,1000000) ? Number(req.query.page) : 1;
  const pageSize = whole(req.query.pageSize,1,1000000) ? Math.min(Number(req.query.pageSize),50) : 5;

  const result = repository.query({ search, category, sort, dir, page, pageSize });
  res.json(result);
});

app.get("/api/categories", (req, res) => {
  res.json(repository.categories());
});

app.post("/api/products", validateProduct, (req, res) => {
  res.status(201).json(repository.create(req.body));
});

app.put("/api/products/:id", validateProduct, (req, res) => {
  const product = repository.update(req.params.id, req.body);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }
  res.json(product);
});

app.delete("/api/products/:id", (req, res) => {
  const removed = repository.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Product not found." });
  }
  res.status(204).send();
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Stock Catalog API listening on http://localhost:${port}`);
});

function validateProduct(req, res, next) {
  const { name, category, price, stock } = req.body;
  if (!isText(name,2) || !isText(category,2) || !whole(stock,0,1000000000) ||
      !(typeof price === "number" || typeof price === "string" && price.trim() !== "") || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 9999999999.99)
    return res.status(400).json({ error: "Use bounded names, a finite price and a whole stock count." });
  next();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createProductRepository() {
  let products = seedProducts();

  function compare(a, b, sort, dir) {
    const factor = dir === "desc" ? -1 : 1;
    const left = a[sort];
    const right = b[sort];
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right)) * factor;
  }

  return {
    categories() {
      return [...new Set(products.map((product) => product.category))].sort();
    },
    query({ search, category, sort, dir, page, pageSize }) {
      const needle = search.toLowerCase();
      const filtered = products.filter((product) => {
        const matchesCategory = category === "all" || product.category === category;
        const matchesSearch = product.name.toLowerCase().includes(needle);
        return matchesCategory && matchesSearch;
      });

      const sorted = [...filtered].sort((a, b) => compare(a, b, sort, dir) || a.id.localeCompare(b.id));

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return { items, total, totalPages, page: safePage, pageSize, sort, dir };
    },
    create(input) {
      const product = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        category: input.category.trim(),
        price: Number(input.price),
        stock: Number(input.stock)
      };
      products.unshift(product);
      return product;
    },
    update(id, input) {
      const existing = products.find((product) => product.id === id);
      if (!existing) return null;
      const updated = {
        ...existing,
        name: input.name.trim(),
        category: input.category.trim(),
        price: Number(input.price),
        stock: Number(input.stock)
      };
      products = products.map((product) => (product.id === id ? updated : product));
      return updated;
    },
    remove(id) {
      const before = products.length;
      products = products.filter((product) => product.id !== id);
      return products.length < before;
    }
  };
}

function seedProducts() {
  const categories = ["Audio", "Computers", "Mobile", "Gaming", "Home"];
  const nouns = ["Hub", "Cable", "Stand", "Adapter", "Dock", "Mouse", "Keyboard", "Charger", "Speaker", "Webcam", "Monitor", "Headset"];
  const products = [];
  for (let i = 0; i < 47; i += 1) {
    const category = categories[i % categories.length];
    const noun = nouns[i % nouns.length];
    products.push({
      id: crypto.randomUUID(),
      name: `${category} ${noun} ${100 + i}`,
      category,
      price: Number((5 + (i % 12) * 7.5).toFixed(2)),
      stock: (i * 7) % 60
    });
  }
  return products;
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function whole(value, min, max) { return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max; }
