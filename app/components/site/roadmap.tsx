"use client";

import { motion } from "motion/react";
import { ROADMAP } from "@/lib/site/config";
import { Reveal } from "@/components/site/reveal";
import { staggerContainer, staggerItem } from "@/lib/site/motion";

export function Roadmap() {
  return (
    <section id="roadmap" className="bg-section-muted py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
          <p className="eyebrow mb-4 text-text-muted">{ROADMAP.eyebrow}</p>
          <h2 className="headline-serif text-4xl text-slate-900 md:text-5xl">{ROADMAP.headline}</h2>
          <p className="body-copy-dark mx-auto mt-5 max-w-xl text-[1rem]">{ROADMAP.intro}</p>
        </Reveal>

        {/* spectrum-beam timeline */}
        <div className="relative mx-auto max-w-2xl">
          <div aria-hidden className="spectrum-bar absolute bottom-2 left-[1.15rem] top-2 w-px opacity-50" />
          <motion.ol
            className="space-y-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {ROADMAP.items.map((item, i) => (
              <motion.li key={item.title} variants={staggerItem} className="relative pl-12">
                <span
                  aria-hidden
                  className="absolute left-[1.15rem] top-6 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white"
                  style={{ boxShadow: "0 0 0 1px rgba(15,23,42,0.14), 0 0 12px rgba(200,169,81,0.55)" }}
                />
                <div className="feature-card floaty p-6" style={{ animationDelay: `${i * 0.5}s` }}>
                  <span className="soon-pill">{item.tag}</span>
                  <h3 className="mt-3 text-[1.0625rem] font-medium tracking-[-0.02em] text-slate-900">
                    {item.title}
                  </h3>
                  <p className="body-copy-dark mt-2">{item.body}</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>

        <Reveal className="mx-auto mt-12 max-w-xl text-center">
          <p className="text-[0.8125rem] text-text-muted">{ROADMAP.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
