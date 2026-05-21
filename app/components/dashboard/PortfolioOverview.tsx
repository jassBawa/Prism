"use client";
import type { Live } from "@/lib/types";
import { usd, num } from "@/lib/format";
import { IconCoins, IconLayers, IconWallet, IconScale } from "@/components/ui/icons";

interface Props {
  lives: Live[];
  holdingsUsd: number;
  connected: boolean;
  loading: boolean;
}

export function PortfolioOverview({ lives, holdingsUsd, connected, loading }: Props) {
  const tvl = lives.reduce((s, l) => s + l.navUsd, 0);
  const inBalance = lives.filter((l) => l.maxDriftBps <= l.view.thresholdBps).length;

  const cards = [
    { label: "Total value locked", value: usd(tvl, { compact: true }), icon: <IconCoins width={14} height={14} />, delta: `${lives.length} baskets priced live` },
    { label: "Your holdings", value: connected ? usd(holdingsUsd, { compact: true }) : "—", icon: <IconWallet width={14} height={14} />, delta: connected ? "across all baskets" : "connect wallet to view", tiny: !connected },
    { label: "Active baskets", value: num(lives.length, 0), icon: <IconLayers width={14} height={14} />, delta: lives.length ? "tap a card for detail" : "none yet" },
    { label: "In balance", value: lives.length ? `${inBalance}/${lives.length}` : "—", icon: <IconScale width={14} height={14} />, delta: "within drift threshold" },
  ];

  if (loading) {
    return (
      <div className="stats">
        {cards.map((_, i) => (
          <div key={i} className="skel" style={{ height: 104 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="stats">
      {cards.map((c) => (
        <div key={c.label} className="stat">
          <div className="label">
            {c.icon}
            {c.label}
          </div>
          <div className={"value" + (c.tiny ? " tiny" : "")}>{c.value}</div>
          <div className="delta">{c.delta}</div>
        </div>
      ))}
    </div>
  );
}
