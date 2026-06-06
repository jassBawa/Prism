"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMarketPrices, tickerPrice } from "@/lib/prices";
import { Reveal } from "@/components/site/reveal";
import { fadeUp, staggerContainer, staggerItem, viewport } from "@/lib/site/motion";

// A representative basket. On-chain you compose your own (2–4 assets); this is
// the canonical SOL/JUP/USDC example used across the docs.
const ASSETS = [
  { symbol: "SOL", name: "Solana", weight: 50, color: "#9945FF" },
  { symbol: "JUP", name: "Jupiter", weight: 30, color: "#38bdf8" },
  { symbol: "USDC", name: "USD Coin", weight: 20, color: "#2563eb" },
] as const;

function TokenMark({ symbol, color, src }: { symbol: string; color: string; src?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={symbol} width={32} height={32} className="size-8 rounded-full" loading="lazy" />;
  }
  return (
    <span
      className="flex size-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}

export function WhatsInside() {
  const prices = useMarketPrices();
  const priceFor = (symbol: string) => prices.find((p) => p.symbol === symbol);
  const [active, setActive] = useState<string | null>(null);

  return (
    <section id="inside" className="bg-section-muted py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center md:mb-14">
          <p className="eyebrow mb-4 text-text-muted">What&apos;s inside</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-[2.5rem]">
            A diversified basket, in a single token.
          </h2>
          <p className="body-copy-dark mx-auto mt-3 max-w-xl text-[1rem]">
            One mint represents weighted exposure to every asset in the vault. Hold it,
            transfer it, or redeem it for the underlying — no swaps, no slippage.
          </p>
        </Reveal>

        <div className="mx-auto max-w-xl">
          <motion.ul
            className="flex flex-col gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {ASSETS.map((a) => {
              const p = priceFor(a.symbol);
              const up = (p?.change24h ?? 0) >= 0;
              const isActive = active === a.symbol;
              return (
                <motion.li
                  key={a.symbol}
                  variants={staggerItem}
                  onMouseEnter={() => setActive(a.symbol)}
                  onMouseLeave={() => setActive(null)}
                  className="flex items-center gap-4 rounded-2xl border bg-white px-4 py-3.5 transition-[border-color,box-shadow] duration-300"
                  style={{
                    borderColor: isActive ? `${a.color}66` : "rgba(15,23,42,0.06)",
                    boxShadow: isActive
                      ? `0 8px 24px -10px ${a.color}80`
                      : "0 1px 2px rgba(15,23,42,0.04)",
                  }}
                >
                  <TokenMark symbol={a.symbol} color={a.color} src={p?.image} />
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-medium tracking-[-0.01em] text-slate-900">
                      {a.name}
                    </p>
                    <p className="text-xs text-text-muted">{a.symbol}</p>
                  </div>

                  <div className="ml-auto flex items-center gap-5">
                    <span className="hidden text-right sm:block">
                      <span className="block text-[0.9375rem] tabular-nums text-slate-900">
                        {p ? tickerPrice(p.price) : "—"}
                      </span>
                      <span
                        className={`block text-xs tabular-nums ${up ? "text-emerald-600" : "text-rose-500"}`}
                      >
                        {p ? `${up ? "▲" : "▼"} ${Math.abs(p.change24h).toFixed(2)}%` : ""}
                      </span>
                    </span>
                    <span
                      className="inline-flex w-14 justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums text-white"
                      style={{ backgroundColor: a.color }}
                    >
                      {a.weight}%
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
            variants={fadeUp}
            className="mt-5 rounded-2xl border border-amber-500/20 bg-[#faf7ef] px-5 py-4"
          >
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-gold">
              Reliable price source
            </p>
            <p className="body-copy-dark mt-1.5 text-[0.9375rem]">
              Net asset value is computed on-chain from{" "}
              <strong className="font-semibold text-slate-900">Pyth</strong> oracle prices —
              every mint and redeem clears at live NAV, guarded by staleness and confidence
              checks. <span className="text-text-muted">Quotes above are indicative market data.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
