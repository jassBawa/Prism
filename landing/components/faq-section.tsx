"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { APP_URL, DOCS_URL, FAQ, FAQ_SECTION } from "@/lib/config";
import { Reveal } from "@/components/reveal";
import { EASE_OUT } from "@/lib/motion";

export function FaqSection() {
  const [openId, setOpenId] = useState<string>(FAQ[0].id);

  return (
    <section id="faq" className="bg-section-muted py-28 md:py-36">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-20">
          <Reveal>
            <div className="md:sticky md:top-20">
              <p className="eyebrow mb-4 text-text-muted">{FAQ_SECTION.eyebrow}</p>
              <h2 className="headline-serif text-4xl text-slate-900 md:text-5xl">
                {FAQ_SECTION.headline}
              </h2>
              <p className="body-copy-dark mt-5 max-w-sm">
                Everything you need to know about how the vault prices, rebalances, and
                redeems.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={APP_URL} className="faq-cta-primary">
                  Open App
                </a>
                <a href={DOCS_URL} className="faq-cta-ghost">
                  Read docs
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="divide-y divide-slate-200/80 border-t border-slate-200/80">
              {FAQ.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? "" : item.id)}
                      className="group flex w-full items-center justify-between gap-6 py-5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`text-[1.0625rem] tracking-[-0.02em] transition-colors duration-300 ${
                          isOpen ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                        }`}
                      >
                        {item.question}
                      </span>
                      <motion.span
                        className="shrink-0 text-xl leading-none"
                        animate={{ rotate: isOpen ? 45 : 0, color: isOpen ? "#0f172a" : "#cbd5e1" }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        aria-hidden="true"
                      >
                        +
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: EASE_OUT }}
                          className="overflow-hidden"
                        >
                          <p className="body-copy-dark -mt-1 max-w-xl pb-6">{item.answer}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
