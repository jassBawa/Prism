"use client";
import { useEffect, useState } from "react";
import type { MarketPrice } from "@/lib/market";

export type { MarketPrice };

/**
 * Live price + 24h change. Goes through our own `/api/prices` route, which proxies
 * CoinGecko server-side with a shared 60s cache — same-origin (no CORS) and one
 * upstream call for all clients (no per-IP rate-limit / 429 in the browser).
 */
export async function fetchMarketPrices(): Promise<MarketPrice[]> {
  const res = await fetch("/api/prices");
  if (!res.ok) throw new Error(`prices ${res.status}`);
  return (await res.json()) as MarketPrice[];
}

/** Shared hook: fetch market prices on mount, refresh every 60s. Empty on error. */
export function useMarketPrices(): MarketPrice[] {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMarketPrices()
        .then((p) => alive && setPrices(p))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return prices;
}

/** Compact USD string for the ticker/watchlist. */
export function tickerPrice(n: number): string {
  if (n >= 1) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return "$" + n.toPrecision(3);
}
