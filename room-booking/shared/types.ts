// Shared domain types used by both the Express server and the React client.

export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  startsAt: string; // ISO timestamp
  endsAt: string; // ISO timestamp
  bookedBy: string;
}

export interface NewBooking {
  roomId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  bookedBy: string;
}

export interface ApiError {
  error: string;
}
