"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

// Peripheral positions only — keep the centred headline/CTAs clear.
const COINS = [
  { src: "/3d-btc.png", top: "14%", left: "8%", size: 94, depth: 26, delay: 0 },
  { src: "/3d-eth.png", top: "18%", left: "83%", size: 78, depth: 34, delay: 0.7 },
  { src: "/3d-sol.png", top: "56%", left: "5%", size: 104, depth: 30, delay: 1.3 },
  { src: "/3d-usdc.png", top: "51%", left: "87%", size: 76, depth: 22, delay: 0.9 },
  { src: "/3d-matic.png", top: "82%", left: "20%", size: 66, depth: 18, delay: 1.7 },
  { src: "/3d-atom.png", top: "80%", left: "79%", size: 72, depth: 24, delay: 0.4 },
];

function Coin({
  coin,
  index,
  mx,
  my,
  drift,
}: {
  coin: (typeof COINS)[number];
  index: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  drift: MotionValue<number>;
}) {
  const [hover, setHover] = useState(false);
  const x = useTransform(mx, (v) => v * coin.depth);
  const mYmouse = useTransform(my, (v) => v * coin.depth);
  const mYscroll = useTransform(drift, (v) => v * (coin.depth / 28));
  const y = useTransform([mYmouse, mYscroll], ([a, b]: number[]) => a + b);
  const scale = useSpring(hover ? 1.22 : 1, { stiffness: 320, damping: 18 });
  return (
    <motion.div
      className="pointer-events-auto absolute cursor-pointer"
      style={{ top: coin.top, left: coin.left, x, y, scale }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.3 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coin.src}
        alt=""
        aria-hidden
        loading="lazy"
        className="coin-bob select-none"
        style={{
          width: coin.size,
          height: coin.size,
          animationDelay: `${coin.delay}s`,
          filter: hover
            ? "blur(0px) drop-shadow(0 18px 42px rgba(0,0,0,0.55))"
            : "blur(4px) drop-shadow(0 12px 30px rgba(0,0,0,0.45))",
          transition: "filter 0.3s ease",
        }}
      />
    </motion.div>
  );
}

export function HeroCoins() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 40, damping: 16 });
  const smy = useSpring(my, { stiffness: 40, damping: 16 });
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 600], [0, 120]);
  // whole layer fades out as the hero scrolls away
  const layerOpacity = useTransform(scrollY, [0, 450], [1, 0]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  return (
    <motion.div
      style={{ opacity: layerOpacity }}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      {COINS.map((c, i) => (
        <Coin key={c.src} coin={c} index={i} mx={smx} my={smy} drift={drift} />
      ))}
    </motion.div>
  );
}
