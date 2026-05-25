"use client";
import { useMarketPrices, tickerPrice } from "@/lib/prices";

/** Scrolling marquee of live market prices + 24h change. */
export function PriceTicker() {
  const prices = useMarketPrices();
  if (!prices.length) return <div className="ticker ticker-empty" aria-hidden />;
  const items = [...prices, ...prices]; // duplicate for a seamless loop

  return (
    <div className="ticker" role="marquee" aria-label="market prices">
      <div className="ticker-track">
        {items.map((p, i) => (
          <span className="tick" key={i}>
            <span className="tsym">{p.symbol}</span>
            <span className="tprice">{tickerPrice(p.price)}</span>
            <span className={"tchg " + (p.change24h >= 0 ? "up" : "down")}>
              {p.change24h >= 0 ? "▲" : "▼"} {Math.abs(p.change24h).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
