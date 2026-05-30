"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { APP_URL, DOCS_URL } from "@/lib/site/config";
import { blurFadeUp } from "@/lib/site/motion";

export function Nav({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const light = variant === "light";

  // Frost intensifies slightly as you scroll past the hero.
  const { scrollY } = useScroll();
  const shellBlur = useTransform(scrollY, [0, 80], [18, 28]);
  const backdropFilter = useTransform(shellBlur, (v) => `blur(${v}px) saturate(190%)`);

  // Gradient hairline border wrapper — the "p-px gradient" trick.
  const frameClass = light
    ? "rounded-2xl bg-gradient-to-b from-slate-900/[0.1] to-slate-900/[0.02] p-px shadow-[0_14px_40px_-22px_rgba(15,23,42,0.25)]"
    : "rounded-2xl bg-gradient-to-b from-white/25 to-white/[0.04] p-px shadow-[0_22px_60px_-30px_rgba(0,0,0,0.7)]";

  // Glass: a LIGHT translucent tint + heavy blur — lets the prism frost through.
  const shellClass = light
    ? "rounded-[calc(1rem-1px)] bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
    : "rounded-[calc(1rem-1px)] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.04)]";

  return (
    <motion.header
      className="sticky top-0 z-50 w-full"
      initial="hidden"
      animate="visible"
      variants={blurFadeUp}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6 sm:pt-4">
        <div className={frameClass}>
          <motion.div
            className={shellClass}
            style={{
              backdropFilter,
              WebkitBackdropFilter: backdropFilter,
            }}
          >
            <div className="flex items-center justify-between gap-6 px-3.5 py-2.5 sm:px-4 lg:px-5 lg:py-3">
              <Link
                href="/"
                className={`group inline-flex items-center gap-2.5 no-underline transition-opacity hover:opacity-90 ${
                  light ? "text-slate-900" : "text-white"
                }`}
              >
                <span className="rounded-[0.7rem] bg-gradient-to-br from-white/60 to-white/20 p-[1.5px] shadow-sm transition-transform duration-300 group-hover:rotate-[8deg]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="size-7 rounded-[0.6rem] bg-white object-contain p-1"
                    src="/logo.png"
                    alt="Prism"
                    width={28}
                    height={28}
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-serif text-[1.0625rem] leading-none tracking-[-0.03em] lg:text-[1.125rem]">
                    Prism
                  </span>
                  <span className={`text-[0.6875rem] font-medium leading-none tracking-[-0.01em] ${light ? "text-slate-500" : "text-white/55"}`}>
                    On-chain index funds
                  </span>
                </span>
              </Link>

              <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Site">
                <Link
                  href={DOCS_URL}
                  className={`hidden rounded-full px-3 py-1.5 text-sm font-medium tracking-[-0.01em] no-underline transition-colors sm:inline-flex ${
                    light
                      ? "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Docs
                </Link>
                <Link
                  href={APP_URL}
                  className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold tracking-[-0.015em] no-underline transition-all duration-200 hover:-translate-y-px lg:px-5 ${
                    light
                      ? "bg-slate-900 text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.6)] hover:bg-slate-800"
                      : "bg-white text-slate-900 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_28px_-8px_rgba(255,255,255,0.5)]"
                  }`}
                >
                  Open app
                  <ArrowUpRight className="size-4 -mr-0.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </nav>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
