# Library Lending Codebase Guide

This project is a React + Express CRUD app for library circulation and borrower tracking. It is intentionally shaped like a small corporate internal tool: the server owns validation and query behavior, the client owns form/view state, and client/src/api.js is the boundary between them.

## Code map

- server/server.js defines the Express API, in-memory repository, validation, pagination, stats, status changes, and nested activity logs.
- client/src/api.js wraps every HTTP call so React components do not contain raw fetch details.
- client/src/App.jsx contains the dashboard UI, controlled form, filters, pagination, selected record state, and activity panel.
- client/src/styles.css provides dense dashboard styling suitable for repeated operational use.

## Main API shape

`js
GET    /api/loans?search=&status=&category=&page=&pageSize=&sort=&dir=
GET    /api/loans/stats
GET    /api/loans/:id
POST   /api/loans
PUT    /api/loans/:id
PATCH  /api/loans/:id/status
DELETE /api/loans/:id
GET    /api/loans/:id/activity
POST   /api/loans/:id/activity
`

The important architectural lesson is that not every mutation needs to be a full update. PATCH /status models a focused business action, while POST /activity models a nested resource.

## Server-side query pipeline

The repository list endpoint follows this order:

`js
filter by search/status/category -> sort -> paginate -> return metadata
`

That order matters in real apps. If pagination happens before filtering, users get confusing totals and missing records.

## React state to notice

`js
const [query, setQuery] = useState({ search: "", status: "all", category: "all", page: 1 });
const [form, setForm] = useState(emptyForm);
const [editingId, setEditingId] = useState(null);
const [selectedId, setSelectedId] = useState(null);
`

These states represent different concerns: server query state, form draft state, edit mode, and selected-record detail state. Keeping them separate is a habit that scales.

## Extension practice

- Replace the in-memory repository with JSON-file persistence.
- Add role-based validation for who can change status.
- Add a true audit event type for each mutation.
- Sync filters to the URL query string.
- Split App.jsx into RecordForm, RecordList, and ActivityPanel components.
