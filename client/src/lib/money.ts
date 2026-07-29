/**
 * src/lib/money.ts  (Brick 10c)
 *
 * Display-only formatting for money values.
 *
 * ALL money fields are strings end-to-end (Postgres numeric → JSON string).
 * EXCEPTION: GET /retainer/properties/:pid/balance returns { balance: number|string }
 *   — always String() it before passing here; never do arithmetic on it in the client.
 *
 * formatMoney: string → "$1,234.56" for display.
 * Never use Number() / parseFloat() for math — display only.
 */

/**
 * Format a money string for display.
 * Handles "0", "1234.5", "1234.56", null, undefined safely.
 * Always shows 2 decimal places.
 */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === "") return "$—";
  const n = parseFloat(value);
  if (isNaN(n)) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Compute the percentage of a balance relative to a target, as a display string.
 * Both arguments are money strings. Returns e.g. "42%" or "—".
 * NEVER used for business logic — display only.
 */
export function balancePctDisplay(balance: string, target: string): string {
  const b = parseFloat(balance);
  const t = parseFloat(target);
  if (isNaN(b) || isNaN(t) || t === 0) return "—";
  const pct = Math.round((b / t) * 100);
  return `${pct}%`;
}
