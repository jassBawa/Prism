"use client";
import { usePrism, NETWORK } from "./PrismProvider";
import { usd } from "@/lib/format";
import { IconRefresh } from "@/components/ui/icons";

/** Persistent ground-floor status line — live network + protocol state. */
export function StatusBar() {
  const p = usePrism();
  const tvl = p.lives.reduce((s, l) => s + l.navUsd, 0);

  return (
    <div className="statusbar">
      <span className="sb-item">
        <span className="sb-dot" /> <span className="sb-strong">Live</span> · {NETWORK}
      </span>
      <span className="sb-sep" />
      <span className="sb-item">
        <span className="sb-strong">{p.lives.length}</span> funds
      </span>
      <span className="sb-sep" />
      <span className="sb-item">
        <span className="sb-strong">{usd(tvl, { compact: true })}</span> TVL
      </span>
      <span className="sb-right">
        <span className="sb-item">Prices · CoinGecko</span>
        <IconRefresh className="sb-spin" width={12} height={12} />
      </span>
    </div>
  );
}
