"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { APP_URL, HERO } from "@/lib/site/config";
import { staggerContainer, staggerItem } from "@/lib/site/motion";
import { Nav } from "@/components/site/nav";
import { HeroCoins } from "@/components/site/hero-coins";
import Prism from "@/components/Prism";

export function HeroOrbit() {
  const sectionRef = useRef<HTMLElement | null>(null);
  // Parallax: the prism drifts down, scales up and fades as the hero scrolls away.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const prismY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const prismScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const prismOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.15]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-dvh flex-col overflow-hidden text-white"
      style={{ backgroundColor: "#161616" }}
    >
      {/* Prism — official ReactBits setup: a full-size relative parent the canvas fills. */}
      <motion.div
        style={{ y: prismY, scale: prismScale, opacity: prismOpacity }}
        className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform"
      >
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0}
          glow={1}
          transparent
          suspendWhenOffscreen
        />
      </motion.div>

      {/* scrim: protect the headline at center, let the spectrum bleed to the edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 54% at 50% 46%, rgba(16,16,16,0.78) 0%, rgba(16,16,16,0.4) 46%, rgba(16,16,16,0) 78%)",
        }}
        aria-hidden="true"
      />

      {/* fade the dark hero into the light section below it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-48 bg-gradient-to-b from-transparent to-[#f7f7f5]"
      />

      <HeroCoins />

      <Nav />

      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <motion.div
          className="flex flex-col items-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={staggerItem}
            className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-3 pr-4 backdrop-blur-md"
          >
            <span className="live-dot" aria-hidden />
            <span className="text-sm font-medium tracking-[-0.01em] text-white/80">
              Live on Solana devnet
            </span>
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text font-sans text-[3rem] font-bold leading-[0.98] tracking-[-0.035em] text-transparent [filter:drop-shadow(0_4px_40px_rgba(0,0,0,0.45))] md:text-7xl lg:text-[5rem]"
          >
            One deposit.
            <br />A whole portfolio.
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="mt-7 max-w-xl text-[1.125rem] leading-relaxed tracking-[-0.01em] text-white/70"
          >
            {HERO.subcopy}
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="pointer-events-auto mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href={APP_URL}
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-8 py-4 text-[0.95rem] font-semibold tracking-[-0.015em] text-slate-900 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_-10px_rgba(255,255,255,0.55)]"
              aria-label="Open the Prism app"
            >
              Open App
              <ArrowUpRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-[0.95rem] font-medium tracking-[-0.015em] text-white/90 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
            >
              How it works
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-slate-400"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      >
        <ChevronDown className="size-5" />
      </motion.div>
    </section>
  );
}
