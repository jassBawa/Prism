"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, viewport } from "@/lib/site/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      variants={fadeUp}
      transition={{ delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
