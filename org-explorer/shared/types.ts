// Shared domain types used by both the Express server and the React client.

export interface OrgNode {
  id: string;
  parentId: string | null;
  name: string;
  title: string;
}

// Returned by GET /api/tree — the adjacency list assembled into a nested tree.
export interface TreeNode extends OrgNode {
  depth: number;
  children: TreeNode[];
}

// Returned by GET /api/nodes/:id — facts derived with recursive CTEs.
export interface NodeDetail {
  node: OrgNode;
  depth: number;
  descendantCount: number;
  ancestors: OrgNode[]; // root → parent
}

export interface NewNode {
  parentId: string | null;
  name: string;
  title: string;
}

export interface ApiError {
  error: string;
}
