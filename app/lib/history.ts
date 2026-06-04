import { FAUCET_URL } from "./faucet";

// NAV time-series served by the ops/keeper service (same host as the faucet).
export interface NavPoint {
  t: number; // ms epoch
  nav: number; // USD
}

/** Fetch a basket's NAV history (empty array if the indexer has no points yet / is offline). */
export async function fetchNavHistory(basket: string): Promise<NavPoint[]> {
  try {
    const r = await fetch(`${FAUCET_URL}/history?basket=${basket}`);
    if (!r.ok) return [];
    const j = (await r.json()) as { points?: NavPoint[] };
    return j.points ?? [];
  } catch {
    return [];
  }
}
