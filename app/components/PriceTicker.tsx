"use client";
import { useMarketPrices, tickerPrice } from "@/lib/prices";

const shell =
  "sticky top-0 z-[60] flex h-[38px] items-center overflow-hidden whitespace-nowrap border-b border-[color-mix(in_srgb,var(--line-strong)_72%,transparent)] bg-[color-mix(in_srgb,var(--chrome)_76%,transparent)] backdrop-blur-[16px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_0_rgba(0,0,0,0.18)] [html[data-theme=light]_&]:border-slate-900/10 [html[data-theme=light]_&]:bg-white/78 [html[data-theme=light]_&]:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)]";

/** Scrolling marquee of live market prices + 24h change. */
export function PriceTicker() {
  const prices = useMarketPrices();
  if (!prices.length) return <div className={`${shell} ticker-empty`} aria-hidden />;
  const items = [...prices, ...prices]; // duplicate for a seamless loop

  return (
    <div className={shell} role="marquee" aria-label="market prices">
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
