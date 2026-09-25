import { format, parseISO } from "date-fns";

// Both "2026-08-24" (date-only, parsed as local midnight) and full ISO datetimes with offsets.
export function fmtDate(value: string): string {
  const d = parseISO(value);
  return isNaN(d.getTime()) ? value : format(d, "d MMM yyyy");
}

export function fmtDateLong(value: string): string {
  const d = parseISO(value);
  return isNaN(d.getTime()) ? value : format(d, "d MMMM yyyy");
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
