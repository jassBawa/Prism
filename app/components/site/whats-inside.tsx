"use client";

import { motion } from "motion/react";
import { useMarketPrices, tickerPrice } from "@/lib/prices";
import { Reveal } from "@/components/site/reveal";
import { EASE_OUT, fadeUp, staggerContainer, staggerItem, viewport } from "@/lib/site/motion";

// A representative basket. On-chain you compose your own (2–4 assets); this is
// the canonical SOL/JUP/USDC example used across the docs.
const ASSETS = [
  { symbol: "SOL", name: "Solana", weight: 50, color: "#9945FF" },
  { symbol: "JUP", name: "Jupiter", weight: 30, color: "#38bdf8" },
  { symbol: "USDC", name: "USD Coin", weight: 20, color: "#2563eb" },
] as const;

const R = 46;
const STROKE = 14;

// Precompute donut segments (cumulative offsets) once.
let acc = 0;
const SEGMENTS = ASSETS.map((a) => {
  const frac = a.weight / 100;
  const seg = { ...a, frac, offset: acc };
  acc += frac;
  return seg;
});

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

  return (
    <section id="inside" className="bg-section-muted py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center md:mb-20">
          <p className="eyebrow mb-4 text-text-muted">What&apos;s inside</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-[2.5rem]">
            A diversified basket, in a single token.
          </h2>
          <p className="body-copy-dark mx-auto mt-3 max-w-xl text-[1rem]">
            One mint represents weighted exposure to every asset in the vault. Hold it,
            transfer it, or redeem it for the underlying — no swaps, no slippage.
          </p>
        </Reveal>

        <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-14">
          {/* Donut */}
          <Reveal>
            <div className="feature-card relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center p-8">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="#e9e9e4" strokeWidth={STROKE} />
                {SEGMENTS.map((s) => (
                  <motion.circle
                    key={s.symbol}
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                    pathLength={1}
                    transform={`rotate(${s.offset * 360} 60 60)`}
                    initial={{ strokeDasharray: "0 1" }}
                    whileInView={{ strokeDasharray: `${s.frac} ${1 - s.frac}` }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-4xl leading-none text-slate-900">3</span>
                <span className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-text-muted">
                  assets
                </span>
              </div>
            </div>
          </Reveal>

          {/* Asset rows + Pyth callout */}
          <div>
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
                return (
                  <motion.li
                    key={a.symbol}
                    variants={staggerItem}
                    className="flex items-center gap-4 rounded-2xl border border-slate-900/[0.06] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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
      </div>
    </section>
  );
}
