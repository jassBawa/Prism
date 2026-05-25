"use client";
import { useEffect, useState } from "react";
import { IconClose } from "@/components/ui/icons";

// The deposit -> stay-balanced -> withdraw loop, in one line each (mirrors the
// landing site's "how it works" copy).
const STEPS = [
  {
    n: "1",
    title: "Deposit one token",
    body: "Send USDC, get one fund token priced live off Pyth. Diversified exposure in a single transaction.",
  },
  {
    n: "2",
    title: "It rebalances itself",
    body: "As prices drift, anyone can trade the fund back to target for a small reward — so it stays on target with nobody at the wheel.",
  },
  {
    n: "3",
    title: "Exit on your terms",
    body: "Redeem your token for your share of every asset inside. No swap, no slippage, no lockup.",
  },
];

export function HowItWorks() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem("prism.onboarded") !== "1");
  }, []);
  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("prism.onboarded", "1");
    setShow(false);
  };

  return (
    <div className="howto">
      <div className="howto-head">
        <span className="howto-eyebrow">How Prism works</span>
        <button className="howto-x" onClick={dismiss} aria-label="Dismiss">
          <IconClose width={15} height={15} />
        </button>
      </div>
      <div className="howto-steps">
        {STEPS.map((s) => (
          <div className="howto-step" key={s.n}>
            <span className="howto-n">{s.n}</span>
            <div className="howto-text">
              <div className="howto-t">{s.title}</div>
              <div className="howto-b">{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
