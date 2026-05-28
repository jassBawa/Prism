"use client";

import { motion } from "motion/react";
import { HOW_IT_WORKS, SHOWCASE, STEPS } from "@/lib/site/config";
import { Reveal } from "@/components/site/reveal";
import { EASE_OUT, scaleIn, staggerContainer, staggerItem } from "@/lib/site/motion";
import { BasketVisual } from "@/components/site/feature-visuals/basket-visual";
import { RebalanceVisual } from "@/components/site/feature-visuals/rebalance-visual";

const VISUALS = {
  basket: BasketVisual,
  rebalance: RebalanceVisual,
} as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-section-light py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center md:mb-24">
          <p className="eyebrow mb-4 text-text-muted">{HOW_IT_WORKS.eyebrow}</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-5xl lg:text-[3.25rem]">
            {HOW_IT_WORKS.headline}
          </h2>
          <p className="body-copy-dark mx-auto mt-5 max-w-xl text-[1rem]">
            {HOW_IT_WORKS.summary}
          </p>
        </Reveal>

        <motion.ol
          className="relative mx-auto mb-24 grid max-w-5xl gap-10 md:mb-32 md:grid-cols-3 md:gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div
            className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent md:block"
            aria-hidden="true"
          />
          {STEPS.map((step) => (
            <motion.li key={step.number} variants={staggerItem} className="relative">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold tracking-wide text-slate-900 shadow-sm">
                {step.number}
              </div>
              <h3 className="text-[1.0625rem] font-medium tracking-[-0.02em] text-slate-900">
                {step.title}
              </h3>
              <p className="body-copy-dark mt-2 max-w-xs">{step.description}</p>
            </motion.li>
          ))}
        </motion.ol>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
          {SHOWCASE.map(({ visual, title, description }, index) => {
            const Visual = VISUALS[visual];
            return (
              <Reveal key={visual} delay={index * 100}>
                <article className="feature-panel group flex h-full flex-col p-6 sm:p-8 md:p-10">
                  <motion.div
                    className="mx-auto mb-10 w-full max-w-sm"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-64px" }}
                    variants={scaleIn}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  >
                    <Visual />
                  </motion.div>
                  <div className="mt-auto">
                    <h3 className="max-w-md text-[1.0625rem] font-medium leading-snug tracking-[-0.02em] text-slate-900">
                      {title.prefix}
                      <strong className="font-semibold text-slate-900">{title.highlight}</strong>
                      {title.suffix}
                    </h3>
                    <p className="body-copy-dark mt-3 max-w-md">{description}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
