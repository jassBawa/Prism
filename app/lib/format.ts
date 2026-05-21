/** Presentation-only formatting helpers. Pure, no side effects. */

export function usd(n: number, opts?: { compact?: boolean }): string {
  if (!isFinite(n)) return "$0.00";
  if (opts?.compact && Math.abs(n) >= 1000) {
    return (
      "$" +
      new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    );
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Price with adaptive precision (cheap tokens show more decimals). */
export function price(n: number): string {
  if (!isFinite(n) || n === 0) return "$0.00";
  const digits = n >= 1 ? 4 : n >= 0.01 ? 5 : 7;
  return "$" + n.toFixed(digits);
}

export function num(n: number, digits = 3): string {
  if (!isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

export function pct(bps: number): string {
  return (bps / 100).toFixed(1) + "%";
}

export function shortAddr(addr: string, n = 4): string {
  return addr.length <= n * 2 ? addr : `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
