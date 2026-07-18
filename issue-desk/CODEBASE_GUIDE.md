# Issue Desk Codebase Guide

This is a small full-stack CRUD app. Read it like a corporate internal tool: the React client owns interaction state, the Express server owns validation and mutation rules, and `client/src/api.js` is the contract between them.

## Code Map

- `server/server.js`: Express routes, validation, in-memory repository.
- `client/src/api.js`: fetch wrapper and endpoint functions.
- `client/src/App.jsx`: React state, forms, filters, rendering.
- `client/src/styles.css`: page layout and card states.

## API Contract

The client calls routes like:

```js
export async function updateIssue(id, issue) {
  return request(`${API_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(issue)
  });
}
```

This wrapper is the frontend boundary. Components should not scatter raw `fetch()` calls everywhere; centralizing API calls makes endpoint changes easier.

## Server Validation

```js
function validateIssue(req, res, next) {
  const { title, status, priority, assignee } = req.body;
  if (!title || title.trim().length < 3) {
    return res.status(400).json({ error: "Title must be at least 3 characters." });
  }
  next();
}
```

Even if the UI validates later, the server must validate. In corporate systems, server validation protects data integrity and prevents inconsistent records from scripts, old clients, or malicious requests.

## Repository Layer

```js
const repository = createIssueRepository();
app.get("/api/issues", (req, res) => {
  const { status = "all", search = "" } = req.query;
  res.json(repository.list({ status, search }));
});
```

The route delegates data work to a repository. This is a production pattern: controllers/routes should stay thin, while data access and mutation rules live elsewhere.

## React State Flow

```js
const [issues, setIssues] = useState([]);
const [form, setForm] = useState(emptyForm);
const [editingId, setEditingId] = useState(null);
const [filters, setFilters] = useState({ status: "all", search: "" });
```

Separate server data (`issues`) from local form state (`form`) and view state (`filters`, `editingId`). Mixing these is a common source of messy React components.

## Extension Practice

- Add comments to issues as a nested resource.
- Move repository functions into `server/repository.js`.
- Add a `PATCH /api/issues/:id/status` route.
- Add loading and error states to the React UI.
- Convert shared issue values into constants.

When changing this app, update the server route, client API wrapper, React state, and render path together.
