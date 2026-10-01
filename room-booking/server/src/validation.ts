import type { NewBooking } from "../../shared/types.js";
export class ValidationError extends Error {}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ValidationError("Use a valid room or booking id.");
  return value;
}
export function realDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value) || !realDate(value.slice(0,10)) || !Number.isFinite(Date.parse(value))) throw new ValidationError("Times must be real ISO timestamps with an explicit timezone offset.");
  return new Date(value).toISOString();
}
export function parseBooking(body: unknown): NewBooking {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Supply a booking object.");
  const data = body as Record<string, unknown>;
  const text = (key: string) => {
    const value = data[key];
    if (typeof value !== "string" || !value.trim() || value.length > 255) throw new ValidationError(`${key} must be nonempty text up to 255 characters.`);
    return value.trim();
  };
  const startsAt = timestamp(data.startsAt), endsAt = timestamp(data.endsAt);
  if (endsAt <= startsAt) throw new ValidationError("End time must be after the start time.");
  return { roomId: uuid(data.roomId), title: text("title"), bookedBy: text("bookedBy"), startsAt, endsAt };
}
