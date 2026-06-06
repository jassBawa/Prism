"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Reveal } from "@/components/site/reveal";

// Each PNG is a full 2400×943 layer with one coin pre-positioned, so stacking
// them over the gradient recreates the composition. `depth` drives parallax.
const COINS = [
  { src: "/coin-1.png", depth: 34 }, // BTC — foreground
  { src: "/coin-2.png", depth: 26 }, // USDC — mid
  { src: "/coin-4.png", depth: 22 }, // ETH — mid
  { src: "/coin-3.png", depth: 14 }, // USDT — far/small
];

function Coin({
  src,
  depth,
  scroll,
  mx,
  my,
}: {
  src: string;
  depth: number;
  scroll: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const scrollY = useTransform(scroll, [0, 1], [depth, -depth]);
  const mouseY = useTransform(my, (v) => v * depth);
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform([scrollY, mouseY], ([a, b]: number[]) => a + b);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <motion.img
      src={src}
      alt=""
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none absolute inset-0 w-full select-none will-change-transform"
      loading="lazy"
    />
  );
}

export function CoinsBand() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 50, damping: 18 });
  const smy = useSpring(my, { stiffness: 50, damping: 18 });

  return (
    <section className="bg-section-light py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center md:mb-14">
          <p className="eyebrow mb-4 text-text-muted">Why a basket</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-[2.5rem]">
            Diversify without the juggling.
          </h2>
          <p className="body-copy-dark mx-auto mt-3 max-w-xl text-[1rem]">
            Instead of holding and rebalancing a dozen tokens yourself, hold one — weighted,
            auto-rebalanced, and redeemable for the underlying anytime.
          </p>
        </Reveal>

        <Reveal>
          <div
            ref={ref}
            aria-hidden
            className="relative mx-auto max-w-5xl"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              mx.set((e.clientX - r.left) / r.width - 0.5);
              my.set((e.clientY - r.top) / r.height - 0.5);
            }}
            onMouseLeave={() => {
              mx.set(0);
              my.set(0);
            }}
          >
            {/* gradient base — edges masked so it melts into the section (no box/shadow) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bg-image.png"
              alt=""
              className="block w-full select-none"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 96% 76% at 50% 46%, #000 48%, transparent 100%)",
                maskImage: "radial-gradient(ellipse 96% 76% at 50% 46%, #000 48%, transparent 100%)",
              }}
            />
            {COINS.map((c) => (
              <Coin key={c.src} src={c.src} depth={c.depth} scroll={scrollYProgress} mx={smx} my={smy} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
