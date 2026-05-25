import { NextResponse } from "next/server";
import { MARKET_COINS, type MarketPrice } from "@/lib/market";

// Proxy CoinGecko server-side: one cached upstream call per minute for ALL clients
// (avoids per-IP rate limits + CORS that block a direct browser fetch).
export const revalidate = 60;

let lastGood: MarketPrice[] = [];

export async function GET() {
  try {
    const ids = MARKET_COINS.map((c) => c.id).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const j = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const data: MarketPrice[] = MARKET_COINS.map((c) => ({
      symbol: c.symbol,
      price: j[c.id]?.usd ?? 0,
      change24h: j[c.id]?.usd_24h_change ?? 0,
    })).filter((p) => p.price > 0);
    if (data.length) lastGood = data;
    return NextResponse.json(data.length ? data : lastGood);
  } catch {
    // CoinGecko down / rate-limited — serve the last good snapshot.
    return NextResponse.json(lastGood);
  }
}
