"use client";
import { useEffect, useState } from "react";
import { IconClose } from "@/components/ui/icons";

// The deposit -> stay-balanced -> withdraw loop, in one line each (mirrors the
// landing site's "how it works" copy).
const STEPS = [
  {
    n: "1",
    title: "Deposit one token",
    body: "Send USDC and get one fund token, priced live from Pyth oracles — instant diversified exposure.",
  },
  {
    n: "2",
    title: "It stays balanced",
    body: "As prices move, anyone can rebalance the vault to target weights for a small spread — no manual work.",
  },
  {
    n: "3",
    title: "Withdraw anytime",
    body: "Redeem your token for your share of every asset in the fund. No swap, no slippage.",
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
