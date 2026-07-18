import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { NodeDetail, OrgNode, TreeNode } from "../../shared/types";
import { createNode, deleteNode, getNode, getTree, moveNode, renameNode } from "./api";

export default function App() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [message, setMessage] = useState("");

  const [child, setChild] = useState({ name: "", title: "" });
  const [edit, setEdit] = useState({ name: "", title: "" });
  const [moveTarget, setMoveTarget] = useState<string>("");

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    getNode(selectedId)
      .then((d) => {
        setDetail(d);
        setEdit({ name: d.node.name, title: d.node.title });
      })
      .catch((error) => setMessage((error as Error).message));
  }, [selectedId]);

  // Flatten the tree for the "move under…" dropdown.
  const flat = useMemo(() => flatten(tree), [tree]);

  async function refresh() {
    try {
      const next = await getTree();
      setTree(next);
      if (selectedId && !flatten(next).some((n) => n.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function addChild(event: FormEvent) {
    event.preventDefault();
    try {
      await createNode({ parentId: selectedId, name: child.name, title: child.title });
      setChild({ name: "", title: "" });
      setMessage(selectedId ? "Added report." : "Added root node.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    try {
      await renameNode(selectedId, edit);
      setMessage("Saved.");
      await refresh();
      await getNode(selectedId).then(setDetail);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function doMove() {
    if (!selectedId) return;
    try {
      await moveNode(selectedId, moveTarget || null);
      setMessage("Moved.");
      setMoveTarget("");
      await refresh();
      await getNode(selectedId).then(setDetail);
    } catch (error) {
      // The cycle-prevention 400 surfaces here.
      setMessage((error as Error).message);
    }
  }

  async function removeNode() {
    if (!selectedId) return;
    try {
      await deleteNode(selectedId);
      setMessage("Deleted (and its whole subtree).");
      setSelectedId(null);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TS · React · Node · Postgres — Project 7</p>
          <h1>Org Explorer</h1>
        </div>
        <p className="muted">Adjacency list + recursive CTEs</p>
      </section>

      <section className="grid">
        <section className="panel">
          <h2>Org chart</h2>
          <div className="tree">
            {tree.map((node) => (
              <NodeBranch key={node.id} node={node} selectedId={selectedId} onSelect={setSelectedId} />
            ))}
            {tree.length === 0 && <p className="muted">No nodes — add a root below.</p>}
          </div>

          <form className="root-add" onSubmit={selectedId ? undefined : addChild}>
            {!selectedId && (
              <>
                <h3>Add a root node</h3>
                <input placeholder="Name" value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} />
                <input placeholder="Title" value={child.title} onChange={(e) => setChild({ ...child, title: e.target.value })} />
                <button type="submit">Add root</button>
              </>
            )}
          </form>
        </section>

        <section className="panel">
          {detail && selectedId ? (
            <>
              <h2>{detail.node.name}</h2>
              <p className="muted">{detail.node.title || "No title"}</p>

              <div className="stats">
                <div><span className="stat">{detail.depth}</span><span className="stat-label">depth</span></div>
                <div><span className="stat">{detail.descendantCount}</span><span className="stat-label">descendants</span></div>
              </div>

              <div className="crumbs">
                {detail.ancestors.length === 0 ? (
                  <span className="muted small">This is a root node.</span>
                ) : (
                  detail.ancestors.map((a) => <span className="crumb" key={a.id}>{a.name}</span>)
                )}
                <span className="crumb current">{detail.node.name}</span>
              </div>

              <form className="block" onSubmit={addChild}>
                <h3>Add report under {detail.node.name}</h3>
                <input placeholder="Name" value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} />
                <input placeholder="Title" value={child.title} onChange={(e) => setChild({ ...child, title: e.target.value })} />
                <button type="submit">Add report</button>
              </form>

              <form className="block" onSubmit={saveEdit}>
                <h3>Edit</h3>
                <input placeholder="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <input placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <button type="submit" className="secondary">Save</button>
              </form>

              <div className="block">
                <h3>Move under…</h3>
                <div className="move-row">
                  <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                    <option value="">(make root)</option>
                    {flat.filter((n) => n.id !== selectedId).map((n) => (
                      <option key={n.id} value={n.id}>{" ".repeat(n.depth * 2)}{n.name}</option>
                    ))}
                  </select>
                  <button type="button" className="secondary" onClick={doMove}>Move</button>
                </div>
                <p className="hint muted small">The server rejects moves that would create a cycle.</p>
              </div>

              <button type="button" className="danger" onClick={removeNode}>Delete subtree</button>
            </>
          ) : (
            <p className="muted">Select a node to inspect its depth, descendants, and ancestry.</p>
          )}
          <p className="message">{message}</p>
        </section>
      </section>
    </main>
  );
}

function NodeBranch({
  node,
  selectedId,
  onSelect
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="branch">
      <button
        type="button"
        className={`node ${node.id === selectedId ? "active" : ""}`}
        onClick={() => onSelect(node.id)}
      >
        <strong>{node.name}</strong>
        <span className="muted small"> · {node.title || "—"}</span>
      </button>
      {node.children.length > 0 && (
        <div className="children">
          {node.children.map((kid) => (
            <NodeBranch key={kid.id} node={kid} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
