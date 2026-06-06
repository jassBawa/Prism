"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Flame,
  Landmark,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Vault,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/site/reveal";
import { EASE_OUT } from "@/lib/site/motion";

// Physics chips (left pit) — the audiences, as draggable tiles.
const CHIPS: { label: string; Icon: LucideIcon }[] = [
  { label: "Traders", Icon: TrendingUp },
  { label: "DAOs", Icon: Landmark },
  { label: "Treasuries", Icon: Vault },
  { label: "Funds", Icon: PieChart },
  { label: "RWAs", Icon: Building2 },
  { label: "Degens", Icon: Flame },
  { label: "Multisigs", Icon: ShieldCheck },
];

// Accordion (right) — who it's for, grounded in Prism's primitives.
const AUDIENCES = [
  {
    id: "traders",
    title: "Traders",
    body: "Automate rebalancing, DCA, and drift control. Hold one token for diversified SOL·JUP·USDC exposure; keepers rebalance the moment weights drift past target — no manual swaps.",
  },
  {
    id: "daos",
    title: "DAOs & Treasuries",
    body: "Park treasury capital in a single, transparent on-chain token. Every holding, weight, and rebalance is verifiable on Solana — and you can redeem in-kind, without slippage.",
  },
  {
    id: "rwa",
    title: "RWAs & Structured Products",
    body: "Bundle tokenized assets — soon including xStocks (tokenized equities on Solana) — into weighted, Pyth-priced baskets you can ship as a single mint.",
  },
  {
    id: "funds",
    title: "Managers & Funds",
    body: "Launch a tokenized index product. Investors mint and redeem at live NAV while the vault keeps itself on target, automatically.",
  },
] as const;

export function WhoItsFor() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [physics, setPhysics] = useState(true);
  const [openId, setOpenId] = useState<string>(AUDIENCES[0].id);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhysics(false);
      return;
    }

    const { Engine, Runner, World, Bodies, Body, Mouse, MouseConstraint } = Matter;

    let W = scene.clientWidth;
    let H = scene.clientHeight;

    const engine = Engine.create();
    engine.gravity.y = 1;
    const world = engine.world;

    const T = 240;
    const ground = Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, { isStatic: true });
    const left = Bodies.rectangle(-T / 2, H / 2, T, H * 4, { isStatic: true });
    const right = Bodies.rectangle(W + T / 2, H / 2, T, H * 4, { isStatic: true });
    World.add(world, [ground, left, right]);

    const bodies = chipRefs.current.map((node, i) => {
      const w = node?.offsetWidth ?? 90;
      const h = node?.offsetHeight ?? 36;
      const x = 30 + Math.random() * Math.max(1, W - 60);
      const y = -50 - i * 48;
      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: 2 },
        restitution: 0.4,
        friction: 0.35,
        frictionAir: 0.012,
      });
      if (node) node.style.opacity = "1";
      return body;
    });
    World.add(world, bodies);

    let mc: Matter.MouseConstraint | null = null;
    if (window.matchMedia("(pointer: fine)").matches) {
      const mouse = Mouse.create(scene);
      const m = mouse as unknown as { mousewheel: EventListener };
      scene.removeEventListener("wheel", m.mousewheel);
      scene.removeEventListener("DOMMouseScroll", m.mousewheel);
      mc = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.18, render: { visible: false } },
      });
      World.add(world, mc);
    }

    const runner = Runner.create();
    Runner.run(runner, engine);

    let raf = 0;
    const sync = () => {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const node = chipRefs.current[i];
        if (!node) continue;
        if (b.position.y > H + 320) {
          Body.setPosition(b, { x: 30 + Math.random() * Math.max(1, W - 60), y: -40 });
          Body.setVelocity(b, { x: 0, y: 0 });
          Body.setAngularVelocity(b, 0);
        }
        const x = b.position.x - node.offsetWidth / 2;
        const y = b.position.y - node.offsetHeight / 2;
        node.style.transform = `translate(${x}px, ${y}px) rotate(${b.angle}rad)`;
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);

    const ro = new ResizeObserver(() => {
      W = scene.clientWidth;
      H = scene.clientHeight;
      Body.setPosition(ground, { x: W / 2, y: H + T / 2 });
      Body.setPosition(right, { x: W + T / 2, y: H / 2 });
    });
    ro.observe(scene);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      Runner.stop(runner);
      if (mc) World.remove(world, mc);
      World.clear(world, false);
      Engine.clear(engine);
    };
  }, []);

  return (
    <section id="who" className="bg-section-muted py-20 md:py-24">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
          {/* Left: physics pit */}
          <Reveal>
            <div
              ref={sceneRef}
              className={`relative aspect-square w-full select-none overflow-hidden rounded-3xl border border-slate-900/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_24px_50px_-28px_rgba(15,23,42,0.25)] ${
                physics ? "" : "flex flex-wrap content-center items-center justify-center gap-3 p-8"
              }`}
              style={{
                background:
                  "linear-gradient(180deg, #ffffff 0%, #fdf2e8 52%, #eef3fb 100%)",
              }}
            >
              {CHIPS.map((c, i) => (
                <div
                  key={c.label}
                  ref={(el) => {
                    chipRefs.current[i] = el;
                  }}
                  className={`flex items-center gap-2 whitespace-nowrap border border-slate-900/10 bg-white px-5 py-3 text-[0.9375rem] font-semibold text-slate-900 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.28)] ${
                    physics ? "absolute left-0 top-0 cursor-grab opacity-0 active:cursor-grabbing" : "relative"
                  }`}
                  style={{ willChange: "transform" }}
                >
                  <c.Icon className="size-[18px] text-accent-gold" strokeWidth={2} aria-hidden />
                  {c.label}
                </div>
              ))}
            </div>
          </Reveal>

          {/* Right: heading + accordion */}
          <Reveal delay={100}>
            <div>
              <p className="eyebrow mb-4 text-text-muted">Who is it for</p>
              <h2 className="headline-serif text-[1.875rem] leading-[1.12] text-slate-900 md:text-4xl lg:text-[2.5rem]">
                Built for the on-chain economy. Across every desk.
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed tracking-[-0.01em] text-slate-600">
                Automate rebalancing with{" "}
                <strong className="font-semibold text-slate-900">keepers</strong> and{" "}
                <strong className="font-semibold text-slate-900">Pyth-priced NAV</strong> then{" "}
                <strong className="font-semibold text-slate-900">redeem in-kind</strong>, any time.
              </p>

              <div className="mt-6 divide-y divide-slate-200/80 border-t border-slate-200/80">
                {AUDIENCES.map((a) => {
                  const isOpen = openId === a.id;
                  return (
                    <div key={a.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? "" : a.id)}
                        className="group flex w-full items-center justify-between gap-6 py-4 text-left"
                        aria-expanded={isOpen}
                      >
                        <span
                          className={`text-[1.0625rem] font-medium tracking-[-0.02em] transition-colors duration-300 ${
                            isOpen ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                          }`}
                        >
                          {a.title}
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
                            <p className="body-copy-dark -mt-1 max-w-xl pb-6">{a.body}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
