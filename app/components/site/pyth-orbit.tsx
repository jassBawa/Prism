"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

/* ───────────────────────────────────────────────────────────────
   PythOrbit — a slowly rotating burst of the Pyth mark with a tight
   center dissolve and a static Prism mark resting in the void.
   Layered for depth, gently alive, and motion-safe.
─────────────────────────────────────────────────────────────────── */

// Softer dissolve: an intermediate stop removes the hard 24%→36% edge.
const FADE =
  "radial-gradient(circle at center, transparent 22%, rgba(0,0,0,0.6) 33%, #000 44%)";

type BurstProps = {
  scale?: number;
  opacity?: number;
  /** seconds per full revolution */
  spin?: number;
  /** flip rotation direction */
  reverse?: boolean;
};

function Burst({ scale = 1, opacity = 1, spin = 200, reverse = false }: BurstProps) {
  return (
    <div className="absolute inset-0" style={{ transform: `scale(${scale})`, opacity }}>
      <div
        className="orbit-layer absolute inset-0 will-change-transform"
        style={
          {
            maskImage: FADE,
            WebkitMaskImage: FADE,
            "--spin": `${spin}s`,
            "--dir": reverse ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        <Image
          src="/images/pyth.avif"
          alt=""
          fill
          sizes="700px"
          priority
          aria-hidden="true"
          className="object-contain"
        />
      </div>
    </div>
  );
}

export function PythOrbit() {
  const dim = "clamp(440px, 68vw, 700px)";

  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      {/* Depth layer — larger + dimmer, same speed */}
      <Burst scale={1.12} opacity={0.35} spin={200} />
      {/* Primary burst */}
      <Burst spin={200} />

      {/* Faint glow beneath the mark so it reads as lit, not pasted on */}
      <div aria-hidden="true" className="orbit-glow pointer-events-none absolute inset-0" />

      {/* Static centered mark, breathing slowly */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Prism" className="orbit-mark h-auto w-[22%]" />
      </div>

      <style jsx global>{`
        @keyframes orbit-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        .orbit-layer {
          animation: orbit-spin var(--spin, 200s) linear infinite;
          animation-direction: var(--dir, normal);
        }
        .orbit-glow {
          background: radial-gradient(
            circle at center,
            rgba(255, 255, 255, 0.14) 0%,
            rgba(255, 255, 255, 0) 60%
          );
          filter: blur(6px);
        }
        .orbit-mark {
          animation: orbit-breathe 7s ease-in-out infinite;
          filter: drop-shadow(0 6px 18px rgba(15, 23, 42, 0.18));
        }
        @media (prefers-reduced-motion: reduce) {
          .orbit-layer,
          .orbit-mark {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}