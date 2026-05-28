"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { APP_URL, DOCS_URL, HERO, STACK } from "@/lib/site/config";
import { EASE_OUT, staggerContainer, staggerItem } from "@/lib/site/motion";
import { Nav } from "@/components/site/nav";

const MARQUEE = [...STACK, ...STACK];

export function Hero() {
  return (
    <section className="hero-bg relative flex min-h-dvh flex-col overflow-hidden text-white">
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ scale: 1 }}
        animate={{ scale: 1.05 }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      >
        <Image
          src={HERO.backgroundSrc}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          aria-hidden="true"
        />
      </motion.div>

      <div className="hero-bg-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <Nav />

      <motion.div
        className="container relative z-10 mx-auto flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center lg:px-12"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={staggerItem}
          className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-sm"
        >
          <span className="live-dot" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-white/75">{HERO.eyebrow}</span>
        </motion.div>

        <motion.h1
          variants={staggerItem}
          className="headline-serif hero-headline max-w-4xl text-[2.75rem] md:text-6xl lg:text-[4.25rem]"
        >
          {HERO.headline}
        </motion.h1>

        <motion.p variants={staggerItem} className="body-copy mt-7 mb-10 max-w-xl">
          Deposit USDC and hold a single basket token for diversified SOL, JUP, and USDC
          exposure — priced by{" "}
          <strong className="font-medium text-white/95">Pyth oracles</strong> and kept on
          target by an{" "}
          <strong className="font-medium text-white/95">auto-rebalancing keeper</strong>.
        </motion.p>

        <motion.div
          variants={staggerItem}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          <Link href={APP_URL} className="shiny-cta" aria-label="Open the Prism app">
            <span>Open App</span>
          </Link>
          <Link href={DOCS_URL} className="btn-outline btn-outline-dark">
            Docs
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto w-full pb-14 lg:pb-16"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.7, ease: EASE_OUT }}
      >
        <p className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
          Built with
        </p>
        <div className="logo-marquee">
          <div className="logo-marquee-track">
            {MARQUEE.map((item, i) =>
              "logoSrc" in item ? (
                <Image
                  key={`${item.name}-${i}`}
                  src={item.logoSrc}
                  alt={item.name}
                  width={120}
                  height={32}
                  className="monotone-logo h-5 w-auto opacity-50"
                />
              ) : (
                <span key={`${item.name}-${i}`} className="logo-wordmark">
                  {item.name}
                </span>
              ),
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
