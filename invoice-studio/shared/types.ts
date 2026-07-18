// Shared domain types — imported by BOTH the server and the React client.
// One source of truth for the shape of the data flowing over the wire.

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Client {
  id: string;
  name: string;
  email: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceSummary {
  id: string;
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  issuedDate: string;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface Invoice extends InvoiceSummary {
  items: InvoiceItem[];
}

export interface NewInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface NewInvoice {
  clientId: string;
  status: InvoiceStatus;
  issuedDate: string;
  taxRate: number;
  items: NewInvoiceItem[];
}

export interface ApiError {
  error: string;
}
