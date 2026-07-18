export interface Item {
  id: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  amount: number;
  priority: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewItem {
  title: string;
  owner: string;
  category: string;
  status: string;
  amount: number;
  priority: string;
  dueDate: string;
  notes: string;
}

export interface ActivityEntry {
  id: string;
  itemId: string;
  kind: string;
  body: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Stats {
  total: number;
  amountTotal: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface ApiError {
  error: string;
}
