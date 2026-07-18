# Issue Desk

A React + Node CRUD project for practicing a real issue-tracking workflow.

## Learning goals

- Build REST endpoints with Express
- Use a small repository layer instead of storing data in route handlers
- Validate request bodies before mutation
- Fetch data from React and keep UI state synchronized
- Practice editing records without losing form state

## Suggested build order

1. Read `server/server.js` and trace every route.
2. Read `client/src/api.js` and see how the frontend talks to the backend.
3. Add one field, such as `estimate`, to both the server and client.
4. Add a new filter, such as priority or assignee.
5. Replace the in-memory repository with JSON-file or database persistence.
