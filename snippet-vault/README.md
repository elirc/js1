# Snippet Vault CRUD

A vanilla JavaScript snippet manager that is deliberately split across
**three ES modules** instead of one `app.js`:

- `src/store.js` — owns the data and every mutation; no DOM access
- `src/dom.js` — pure rendering helpers and the Clipboard API
- `src/main.js` — the entry point that wires events to the store + DOM

## What it practices

- `import` / `export` and separating concerns across files
- Keeping state mutations in one place behind a small API
- The async Clipboard API (`navigator.clipboard.writeText`)
- Tag parsing from comma-separated input
- Search across multiple fields and a language filter

## Running it

Because it uses ES modules, browsers block `import` over the `file://`
protocol. Serve the folder over HTTP first, for example:

```
npx serve snippet-vault
# or
python -m http.server
```

Then open the served URL. Compare this structure with `task-board`, which
does the same job in a single file, and notice what the module split buys you.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): ES modules, normalization and rejected promises, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
