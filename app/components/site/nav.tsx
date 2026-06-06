"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { APP_URL, GITHUB_URL, TWITTER_URL } from "@/lib/site/config";
import { blurFadeUp } from "@/lib/site/motion";

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden>
      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.41 7.86 10.94.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export function Nav({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const light = variant === "light";
  const iconBtn = light
    ? "text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900"
    : "text-white/75 hover:bg-white/10 hover:text-white";

  return (
    <motion.header
      className="sticky top-0 z-50 w-full"
      initial="hidden"
      animate="visible"
      variants={blurFadeUp}
    >
      <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 sm:pt-6">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className={`group inline-flex shrink-0 items-center gap-2.5 no-underline transition-opacity hover:opacity-90 ${
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
            </span>
          </Link>

          {/* Right: socials + CTA */}
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className={`flex size-9 items-center justify-center rounded-full transition-colors ${iconBtn}`}
            >
              <GithubIcon />
            </a>
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className={`flex size-9 items-center justify-center rounded-full transition-colors ${iconBtn}`}
            >
              <XIcon />
            </a>
            <Link
              href={APP_URL}
              className={`group ml-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold tracking-[-0.015em] no-underline transition-all duration-200 hover:-translate-y-px lg:px-5 ${
                light
                  ? "bg-slate-900 text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.6)] hover:bg-slate-800"
                  : "bg-white text-slate-900 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_28px_-8px_rgba(255,255,255,0.5)]"
              }`}
            >
              Open app
              <ArrowUpRight className="-mr-0.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
