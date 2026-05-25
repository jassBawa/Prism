import type { Live } from "./types";
import type { MarketPrice } from "./market";

/** symbol → 24h % change, for quick lookup. */
export function chgMap(prices: MarketPrice[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const p of prices) m[p.symbol] = p.change24h;
  return m;
}

/**
 * A fund's blended 24h move = weighted average of its assets' 24h changes
 * (by current weight). Assets without a market price are skipped. Returns a
 * percent number (e.g. -1.8). Real data when prices are available — gives each
 * fund a live-looking performance figure.
 */
export function fundChange24h(live: Live, chg: Record<string, number>): number {
  let acc = 0;
  let w = 0;
  live.view.assets.forEach((a, i) => {
    const wt = (live.weightsBps[i] ?? 0) / 10000;
    const c = chg[a.symbol];
    if (c !== undefined) {
      acc += wt * c;
      w += wt;
    }
  });
  return w > 0 ? acc / w : 0;
}

/** "+1.8%" / "-0.4%" with a fixed decimal. */
export function signedPct(n: number, digits = 1): string {
  return (n >= 0 ? "+" : "") + n.toFixed(digits) + "%";
}
