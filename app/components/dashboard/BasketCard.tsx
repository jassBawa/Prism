"use client";
import type { Live } from "@/lib/types";
import { assetColor } from "@/lib/constants";
import { usd, price } from "@/lib/format";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";

interface Props {
  live: Live;
  active: boolean;
  onSelect: () => void;
}

export function BasketCard({ live, active, onSelect }: Props) {
  const b = live.view;
  const unitPrice = live.supply > 0 ? live.navUsd / live.supply : 1;
  const symbols = b.assets.map((a) => a.symbol);

  return (
    <button className={"bcard" + (active ? " on" : "")} onClick={onSelect} aria-pressed={active}>
      <div className="bcard-top">
        <div className="bcard-syms">
          <AssetStack symbols={symbols} />
          <span className="bcard-names">{symbols.join(" / ")}</span>
        </div>
        <span className="idtag">#{b.id}</span>
      </div>

      <div className="bcard-nav">
        <div>
          <div className="muted" style={{ fontSize: 11.5 }}>Net asset value</div>
          <div className="nav">{usd(live.navUsd)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: 11.5 }}>unit</div>
          <div className="price">{price(unitPrice)}</div>
        </div>
      </div>

      <div className="stackbar" aria-hidden>
        {b.assets.map((a, i) => (
          <span
            key={i}
            style={{ width: `${(live.weightsBps[i] ?? 0) / 100}%`, background: assetColor(a.symbol, i) }}
            title={`${a.symbol} ${((live.weightsBps[i] ?? 0) / 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <DriftBadge live={live} />
      </div>
    </button>
  );
}
