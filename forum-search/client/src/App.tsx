import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { NewThread, Tag, ThreadPage, ThreadSummary, User } from "../../shared/types";
import {
  createThread,
  deleteThread,
  listTags,
  listUsers,
  searchThreads,
  type ThreadQuery
} from "./api";

const emptyForm = { title: "", body: "", authorId: "", tagText: "" };

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [data, setData] = useState<ThreadPage>({ items: [], total: 0, page: 1, pageSize: 5, totalPages: 1 });
  const [queryState, setQueryState] = useState<ThreadQuery>({ q: "", tag: "", page: 1, pageSize: 5 });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    listUsers().then((u) => {
      setUsers(u);
      if (u[0]) setForm((f) => ({ ...f, authorId: u[0]!.id }));
    }).catch(report);
    refreshTags();
  }, []);

  useEffect(() => {
    search();
  }, [queryState]);

  function report(error: unknown) {
    setMessage((error as Error).message);
  }

  async function refreshTags() {
    try {
      setTags(await listTags());
    } catch (error) {
      report(error);
    }
  }

  async function search() {
    try {
      setData(await searchThreads(queryState));
    } catch (error) {
      report(error);
    }
  }

  // Changing the query or tag resets to page 1; only paging keeps the page.
  function patchQuery(patch: Partial<ThreadQuery>, resetPage = true) {
    setQueryState((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const tagNames = form.tagText.split(",").map((t) => t.trim()).filter(Boolean);
      const payload: NewThread = { title: form.title, body: form.body, authorId: form.authorId, tagNames };
      await createThread(payload);
      setForm({ ...emptyForm, authorId: form.authorId });
      setMessage("Thread posted — its tsvector is generated automatically.");
      await Promise.all([search(), refreshTags()]);
    } catch (error) {
      report(error);
    }
  }

  async function remove(id: string) {
    await deleteThread(id);
    await Promise.all([search(), refreshTags()]);
  }

  const rangeLabel = useMemo(() => {
    if (data.total === 0) return "0 results";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} of ${data.total}`;
  }, [data]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 5</p>
          <h1>Forum Search</h1>
        </div>
        <p className="muted">Full-text search · ranked · paginated</p>
      </section>

      <section className="grid">
        <div className="stack">
          <div className="panel">
            <label htmlFor="q">Search</label>
            <input
              id="q"
              placeholder="Try: postgres index, react types…"
              value={queryState.q ?? ""}
              onChange={(event) => patchQuery({ q: event.target.value })}
            />
            <p className="hint muted">Supports <code>and</code>, <code>or</code>, quotes and <code>-exclude</code> via <code>websearch_to_tsquery</code>.</p>

            <label>Filter by tag</label>
            <div className="tag-cloud">
              <button type="button" className={`tag ${!queryState.tag ? "on" : ""}`} onClick={() => patchQuery({ tag: "" })}>all</button>
              {tags.map((tag) => (
                <button
                  type="button"
                  key={tag.name}
                  className={`tag ${queryState.tag === tag.name ? "on" : ""}`}
                  onClick={() => patchQuery({ tag: tag.name })}
                >
                  {tag.name} <span className="count">{tag.count}</span>
                </button>
              ))}
            </div>
          </div>

          <form className="panel" onSubmit={handleSubmit}>
            <h2>New thread</h2>
            <label htmlFor="field-title">Title</label>
            <input id="field-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

            <label htmlFor="field-body">Body</label>
            <textarea id="field-body" rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />

            <div className="field-row">
              <div>
                <label htmlFor="field-author-id">Author</label>
                <select id="field-author-id" value={form.authorId} onChange={(event) => setForm({ ...form, authorId: event.target.value })}>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>
              </div>
              <div>
                <label>Tags (comma sep.)</label>
                <input value={form.tagText} onChange={(event) => setForm({ ...form, tagText: event.target.value })} placeholder="postgres, search" />
              </div>
            </div>

            <button type="submit">Post thread</button>
            <p role="status" className="message">{message}</p>
          </form>
        </div>

        <section className="panel">
          <div className="results-head">
            <h2>Results</h2>
            <span className="muted">{rangeLabel}</span>
          </div>

          <div className="threads">
            {data.items.map((thread) => (
              <article className="thread" key={thread.id}>
                <header>
                  <h3>{thread.title}</h3>
                  <button type="button" className="danger small-btn" onClick={() => remove(thread.id)}>Delete</button>
                </header>
                <p className="snippet"><Highlighted text={thread.snippet} /></p>
                <p className="meta muted small">
                  by {thread.author} · {thread.createdAt}
                  {thread.tags.map((tag) => <span className="inline-tag" key={tag}>#{tag}</span>)}
                </p>
              </article>
            ))}
            {data.items.length === 0 && <p className="muted">No threads match your search.</p>}
          </div>

          <div className="pager">
            <button type="button" className="secondary" disabled={data.page <= 1} onClick={() => patchQuery({ page: data.page - 1 }, false)}>Prev</button>
            <span className="page-indicator">Page {data.page} / {data.totalPages}</span>
            <button type="button" className="secondary" disabled={data.page >= data.totalPages} onClick={() => patchQuery({ page: data.page + 1 }, false)}>Next</button>
          </div>
        </section>
      </section>
    </main>
  );
}

// The server returns snippets with [[match]] markers. Split on them and wrap
// matches in <mark>. Using text nodes (not innerHTML) keeps this XSS-safe.
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/\[\[(.+?)\]\]/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>
      )}
    </>
  );
}
