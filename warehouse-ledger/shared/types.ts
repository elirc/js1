// Shared domain types used by both the Express server and the React client.

export interface Product {
  id: string;
  sku: string;
  name: string;
  reorderPoint: number;
}

export interface Warehouse {
  id: string;
  name: string;
}

export interface StockLevel {
  productId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  balance: number;
  reorderPoint: number;
  low: boolean;
}

export interface Movement {
  id: string;
  productId: string;
  warehouseId: string;
  warehouseName: string;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface NewMovement {
  productId: string;
  warehouseId: string;
  delta: number;
  reason: string;
}

export interface Transfer {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason: string;
}

export interface ApiError {
  error: string;
}
