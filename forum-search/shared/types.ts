// Shared domain types used by both the Express server and the React client.

export interface User {
  id: string;
  username: string;
}

export interface Tag {
  name: string;
  count: number;
}

export interface ThreadSummary {
  id: string;
  title: string;
  author: string;
  // Snippet uses [[ ]] markers around matches; the client turns them into <mark>.
  snippet: string;
  createdAt: string;
  tags: string[];
}

export interface ThreadPage {
  items: ThreadSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Thread {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  tags: string[];
}

export interface NewThread {
  title: string;
  body: string;
  authorId: string;
  tagNames: string[];
}

export interface ApiError {
  error: string;
}
