"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Coins, Gauge, ShieldCheck } from "lucide-react";
import { EXPLORER_URL, HOW_IT_WORKS, STEPS } from "@/lib/site/config";
import { Reveal } from "@/components/site/reveal";
import { staggerContainer, staggerItem } from "@/lib/site/motion";
import { BasketVisual } from "@/components/site/feature-visuals/basket-visual";
import { RebalanceVisual } from "@/components/site/feature-visuals/rebalance-visual";
import { TOKEN_ICON } from "@/lib/site/tokens";

type Tile = {
  icon: typeof Gauge;
  title: string;
  body: string;
  accent: string;
  href?: string;
  cta?: string;
};

const TILES: Tile[] = [
  {
    icon: Gauge,
    title: "Pyth-priced NAV",
    body: "Mint and redeem at live oracle NAV — staleness and confidence guarded.",
    accent: "#2563eb",
  },
  {
    icon: Coins,
    title: "In-kind redemption",
    body: "Exit straight to the underlying assets. No swap, no slippage.",
    accent: "#38bdf8",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable on-chain",
    body: "Every weight and trade lives on Solana.",
    accent: "#9945FF",
    href: EXPLORER_URL,
    cta: "View program",
  },
];

function FeatureTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <div className="feature-card group flex h-full flex-col p-5">
      <span
        className="flex size-9 items-center justify-center rounded-xl"
        style={{ background: `${tile.accent}14`, border: `1px solid ${tile.accent}33` }}
      >
        <Icon className="size-[18px]" style={{ color: tile.accent }} strokeWidth={1.75} />
      </span>
      <h4 className="mt-4 text-[0.9375rem] font-semibold tracking-[-0.015em] text-slate-900">
        {tile.title}
      </h4>
      <p className="body-copy-dark mt-1.5 text-[0.8125rem]">{tile.body}</p>
      {tile.href ? (
        <a
          href={tile.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.8125rem] font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          {tile.cta}
          <ArrowUpRight className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-section-muted py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center md:mb-24">
          <p className="eyebrow mb-4 text-text-muted">{HOW_IT_WORKS.eyebrow}</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-5xl lg:text-[3.25rem]">
            {HOW_IT_WORKS.headline}
          </h2>
          <p className="body-copy-dark mx-auto mt-5 max-w-xl text-[1rem]">{HOW_IT_WORKS.summary}</p>
          <div className="mt-7 flex items-center justify-center -space-x-2.5">
            {["SOL", "JUP", "USDC"].map((sym) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={sym}
                src={TOKEN_ICON[sym]}
                alt={sym}
                width={40}
                height={40}
                className="size-10 rounded-full bg-white object-contain shadow-sm ring-2 ring-section-light"
                loading="lazy"
              />
            ))}
          </div>
        </Reveal>

        <motion.ol
          className="relative mx-auto mb-24 grid max-w-5xl gap-10 md:mb-32 md:grid-cols-3 md:gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div
            className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent md:block"
            aria-hidden="true"
          />
          {STEPS.map((step) => (
            <motion.li key={step.number} variants={staggerItem} className="relative">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold tracking-wide text-slate-900 shadow-sm">
                {step.number}
              </div>
              <h3 className="text-[1.0625rem] font-medium tracking-[-0.02em] text-slate-900">
                {step.title}
              </h3>
              <p className="body-copy-dark mt-2 max-w-xs">{step.description}</p>
            </motion.li>
          ))}
        </motion.ol>

        <Reveal className="mx-auto mb-14 max-w-2xl text-center md:mb-16">
          <p className="eyebrow mb-4 text-text-muted">What you get</p>
          <h3 className="headline-serif text-3xl text-slate-900 md:text-4xl">
            One token, fully transparent.
          </h3>
          <p className="body-copy-dark mx-auto mt-4 max-w-lg text-[1rem]">
            Diversified exposure and hands-off rebalancing — every weight and trade verifiable
            on-chain.
          </p>
        </Reveal>

        {/* Two feature visuals + a compact stat row */}
        <motion.div
          className="mx-auto max-w-5xl space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <motion.div variants={staggerItem}>
              <BasketVisual />
            </motion.div>
            <motion.div variants={staggerItem}>
              <RebalanceVisual />
            </motion.div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {TILES.map((tile) => (
              <motion.div key={tile.title} variants={staggerItem}>
                <FeatureTile tile={tile} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
