// Shared domain types used by both the Express server and the React client.

export type EventName = "view" | "add_to_cart" | "purchase";

export interface DailyMetric {
  day: string;
  views: number;
  carts: number;
  orders: number;
  revenue: number;
  revenueMa7: number; // 7-day moving average (window function)
  revenueCumulative: number; // running total (window function)
  revenueDelta: number | null; // day-over-day change (LAG)
}

export interface Summary {
  days: number;
  views: number;
  carts: number;
  orders: number;
  revenue: number;
  conversion: number; // orders / views
  avgOrderValue: number; // revenue / orders
}

export interface TopProduct {
  product: string;
  orders: number;
  revenue: number;
  rank: number; // RANK() window function
}

// The materialized view can lag behind raw events until it is refreshed.
export interface Freshness {
  totalEvents: number;
  viewEvents: number;
  stale: boolean;
}

export interface NewEvent {
  name: EventName;
  product: string;
  amount: number;
}

export interface ApiError {
  error: string;
}
