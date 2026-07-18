// Shared domain types used by the server, the WebSocket protocol, and the client.

export interface Room {
  id: string;
  slug: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  body: string;
  createdAt: string;
}

// Messages the server pushes down the socket.
export type ServerEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "presence"; count: number };

// Messages the client sends up the socket.
export type ClientEvent = { type: "message"; author: string; body: string };

export interface ApiError {
  error: string;
}
