/**
 * src/lib/dates.ts  (Brick 10c)
 *
 * Display-only date/time formatting for America/Chicago (SRSC operating timezone).
 * All ISO timestamp strings from the API are UTC-aware (withTimezone on Postgres side).
 *
 * Never do date arithmetic here — display only.
 */

const TZ = "America/Chicago";

/**
 * Format an ISO datetime string to a short local date: "Jul 28, 2026"
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/**
 * Format an ISO datetime string to local date + time: "Jul 28, 8:30 PM"
 */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/**
 * Relative time label: "in 2 days", "3 hours ago", etc.
 * Falls back to fmtDate if Intl.RelativeTimeFormat is unavailable.
 */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const diffMs = new Date(iso).getTime() - Date.now();
    const diffSec = Math.round(diffMs / 1_000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr  = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr  / 24);

    const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
    if (Math.abs(diffDay) >= 1)  return rtf.format(diffDay, "day");
    if (Math.abs(diffHr)  >= 1)  return rtf.format(diffHr, "hour");
    if (Math.abs(diffMin) >= 1)  return rtf.format(diffMin, "minute");
    return "just now";
  } catch {
    return fmtDate(iso);
  }
}
