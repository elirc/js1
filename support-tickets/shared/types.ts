// Shared domain types used by both the Express server and the React client.

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Agent {
  id: string;
  name: string;
  email: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: Agent | null;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketEvent {
  id: string;
  kind: string;
  detail: string;
  createdAt: string;
}

export interface NewTicket {
  subject: string;
  body: string;
  priority: TicketPriority;
  assigneeId: string | null;
  labelIds: string[];
}

export interface ApiError {
  error: string;
}
