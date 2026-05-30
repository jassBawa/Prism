import { NextResponse } from "next/server";
import { MARKET_COINS, type MarketPrice } from "@/lib/market";

// Proxy CoinGecko server-side: one cached upstream call per minute for ALL clients
// (avoids per-IP rate limits + CORS that block a direct browser fetch).
export const revalidate = 60;

let lastGood: MarketPrice[] = [];

export async function GET() {
  try {
    const ids = MARKET_COINS.map((c) => c.id).join(",");
    // /coins/markets returns the icon URL alongside price + 24h change.
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const arr = (await res.json()) as Array<{
      id: string;
      image?: string;
      current_price?: number;
      price_change_percentage_24h?: number;
    }>;
    const byId = new Map(arr.map((x) => [x.id, x]));
    const data: MarketPrice[] = MARKET_COINS.map((c) => {
      const m = byId.get(c.id);
      return {
        symbol: c.symbol,
        price: m?.current_price ?? 0,
        change24h: m?.price_change_percentage_24h ?? 0,
        image: m?.image ?? "",
      };
    }).filter((p) => p.price > 0);
    if (data.length) lastGood = data;
    return NextResponse.json(data.length ? data : lastGood);
  } catch {
    // CoinGecko down / rate-limited — serve the last good snapshot.
    return NextResponse.json(lastGood);
  }
}
