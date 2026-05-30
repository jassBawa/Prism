"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
// import { PrismArt } from "@/components/ui/PrismArt";
import { blurStaggerContainer, blurStaggerItem } from "@/lib/site/motion";

interface Props {
  title: string;
  description: string;
  size?: number;
  children?: ReactNode;
}

const glow =
  "pointer-events-none absolute inset-0 opacity-[0.85] bg-[radial-gradient(ellipse_70%_55%_at_50%_18%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_68%)]";

/** Empty fund list — prism parallax + blur fade-in copy. */
export function FundEmptyState({ title, description, size = 96, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scrollShift = useTransform(scrollYProgress, [0, 1], [14, -14]);
  const scrollDepth = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 0.97]);
  const parallaxX = useSpring(useTransform(pointerX, (v) => v * 0.035), {
    stiffness: 140,
    damping: 22,
  });
  const parallaxY = useSpring(
    useTransform([scrollShift, pointerY], ([scroll, pointer]) => (scroll as number) + (pointer as number) * 0.028),
    { stiffness: 140, damping: 22 },
  );

  return (
    <motion.div
      ref={ref}
      className="empty relative isolate overflow-hidden text-center"
      initial="hidden"
      animate="visible"
      variants={blurStaggerContainer}
      onMouseMove={(e) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        pointerX.set(e.clientX - box.left - box.width / 2);
        pointerY.set(e.clientY - box.top - box.height / 2);
      }}
      onMouseLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <div aria-hidden className={glow} />
      <motion.div
        className="relative z-[1] flex justify-center will-change-transform"
        variants={blurStaggerItem}
        style={{ x: parallaxX, y: parallaxY, scale: scrollDepth }}
      >
        {/* <PrismArt size={size} /> */}
      </motion.div>
      <motion.div className="et relative z-[1]" variants={blurStaggerItem}>
        {title}
      </motion.div>
      <motion.div className="es relative z-[1]" variants={blurStaggerItem}>
        {description}
      </motion.div>
      {children ? (
        <motion.div className="empty-cta relative z-[1]" variants={blurStaggerItem}>
          {children}
        </motion.div>
      ) : null}
    </motion.div>
  );
}
