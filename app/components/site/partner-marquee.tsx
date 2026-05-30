"use client";

import LogoLoop, { type LogoItem } from "@/components/LogoLoop";

// The data + DeFi primitives Prism is built on. Lives in the footer now.
const BUILT_ON = [
  "Solana",
  "Pyth Network",
  "Anchor",
  "SPL Token",
  "Jupiter",
  "Raydium",
] as const;

const LOGOS: LogoItem[] = BUILT_ON.map((name) => ({
  node: (
    <span className="font-medium tracking-[0.01em] text-white/40 transition-colors duration-300 hover:text-white/80">
      {name}
    </span>
  ),
  title: name,
  ariaLabel: name,
}));

export function PartnerMarquee() {
  return (
    <div>
      <p className="eyebrow mb-5 text-center text-white/35">Built on</p>
      <LogoLoop
        logos={LOGOS}
        speed={42}
        gap={56}
        logoHeight={16}
        pauseOnHover
        fadeOut
        fadeOutColor="#06080f"
        ariaLabel="Built on Solana's data and DeFi stack"
      />
    </div>
  );
}
